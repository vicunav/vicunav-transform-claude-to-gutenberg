#!/usr/bin/env node
/**
 * Compara el ancho real de cada sección de nivel superior entre el frontend y
 * el Editor del sitio (Site Editor o editor de página/entrada) para una misma
 * URL. Existe porque la documentación por sí sola no impidió el mismo bug dos
 * veces: un bloque full-bleed en post_content puede quedar clampeado dentro
 * del canvas del editor aunque el frontend lo muestre correctamente a ancho
 * completo (ver references/translation-map.md, "align:\"full\"... no
 * garantiza la clase alignfull"). Este script hace esa comparación real y
 * medible en vez de depender de una inspección visual.
 *
 * Uso:
 *   node verify_editor_frontend_parity.mjs \
 *     --frontend-url=https://sitio.local/pagina/ \
 *     --editor-url=https://sitio.local/wp-admin/post.php?post=78&action=edit \
 *     --cookies=/ruta/a/cookies.json \
 *     [--viewport=1440x900] [--selector="main > *"] [--tolerance=3]
 *
 * `cookies.json` es la salida de wp_auth_cookies.php (ver ese archivo para
 * generarla): { "domain": "...", "cookies": [{ "name", "value", "path" }] }.
 *
 * La comparación es por PORCENTAJE del ancho de referencia de cada contexto
 * (documentElement.clientWidth), no por píxel absoluto: el iframe del editor
 * dispone de menos ancho que el navegador (barra lateral, chrome de
 * wp-admin), así que comparar píxeles crudos entre frontend y editor marca un
 * falso mismatch aunque ambos estén realmente a ancho completo dentro de su
 * propio contexto. `--tolerance` son puntos porcentuales (ej. 3 = 97%-100%
 * ambos se consideran "a ancho completo").
 *
 * Imprime un marcador de éxito solo si todas las secciones comparadas
 * coinciden dentro de la tolerancia. Cualquier discrepancia termina con
 * código de salida distinto de cero y una tabla con los porcentajes reales de
 * cada lado, para que la causa (constrained vs. default, alignfull ausente,
 * CSS de página no cargado en el editor) se diagnostique directo desde la
 * salida.
 */

import fs from 'node:fs';
import { chromium } from 'playwright';
import { parseOptions } from './visual_evidence_lib.mjs';

const { options } = parseOptions(process.argv.slice(2));

function requireOption(name) {
  const value = options.get(name);
  if (!value) {
    console.error(`Falta --${name}.`);
    process.exit(2);
  }
  return value;
}

const frontendUrl = requireOption('frontend-url');
const editorUrl = requireOption('editor-url');
const cookiesPath = requireOption('cookies');
const selector = options.get('selector') ?? 'main > *';
const tolerance = Number(options.get('tolerance') ?? 3);
const [viewportWidth, viewportHeight] = String(options.get('viewport') ?? '1440x900')
  .split('x')
  .map(Number);

if (!fs.existsSync(cookiesPath)) {
  console.error(`No existe el archivo de cookies: ${cookiesPath}`);
  process.exit(2);
}
const cookieData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
if (!cookieData.domain || !Array.isArray(cookieData.cookies) || cookieData.cookies.length === 0) {
  console.error('El archivo de cookies no tiene el formato esperado (domain + cookies[]).');
  process.exit(2);
}

async function measureSections(page, url, { insideEditorCanvas }) {
  // 'networkidle' nunca se cumple de forma confiable en wp-admin: el
  // Heartbeat API sondea el servidor en segundo plano de forma indefinida.
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  let frame = page;
  if (insideEditorCanvas) {
    const iframeElement = await page.waitForSelector('iframe[name="editor-canvas"]', { timeout: 45000 });
    const contentFrame = await iframeElement.contentFrame();
    if (!contentFrame) {
      throw new Error('No se pudo acceder al iframe editor-canvas.');
    }
    frame = contentFrame;
    await frame.waitForSelector(selector, { timeout: 30000 }).catch(() => {});
  } else {
    await page.waitForSelector(selector, { timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(500);

  // Se mide como porcentaje del propio ancho de referencia del contexto
  // (documentElement.clientWidth), no como píxel absoluto: el iframe del
  // editor tiene menos ancho disponible que el navegador (barra lateral,
  // chrome de wp-admin), así que comparar píxeles absolutos entre frontend y
  // editor da un falso mismatch aunque ambos estén realmente a "ancho
  // completo" dentro de su propio contexto. Lo que debe coincidir es la
  // proporción, no el valor bruto.
  return frame.evaluate((sel) => {
    const referenceWidth = document.documentElement.clientWidth;
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map((node, index) => {
      const rect = node.getBoundingClientRect();
      return {
        index,
        tag: node.tagName.toLowerCase(),
        className: node.className && typeof node.className === 'string' ? node.className.slice(0, 80) : '',
        width: Math.round(rect.width),
        referenceWidth,
        percentOfReference: Math.round((rect.width / referenceWidth) * 1000) / 10,
      };
    });
  }, selector);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });
  await context.addCookies(
    cookieData.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookieData.domain,
      path: cookie.path ?? '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })),
  );

  const page = await context.newPage();
  const frontendSections = await measureSections(page, frontendUrl, { insideEditorCanvas: false });
  const editorSections = await measureSections(page, editorUrl, { insideEditorCanvas: true });
  await browser.close();

  const maxLength = Math.max(frontendSections.length, editorSections.length);
  const rows = [];
  let mismatchCount = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const front = frontendSections[index];
    const editor = editorSections[index];
    if (!front || !editor) {
      mismatchCount += 1;
      rows.push({
        index,
        frontendPercent: front ? `${front.percentOfReference}%` : null,
        editorPercent: editor ? `${editor.percentOfReference}%` : null,
        status: 'MISSING',
        tag: front?.tag ?? editor?.tag ?? '',
      });
      continue;
    }
    const delta = Math.round((Math.abs(front.percentOfReference - editor.percentOfReference)) * 10) / 10;
    const ok = delta <= tolerance;
    if (!ok) {
      mismatchCount += 1;
    }
    rows.push({
      index,
      tag: front.tag,
      className: front.className,
      frontendPercent: `${front.percentOfReference}%`,
      editorPercent: `${editor.percentOfReference}%`,
      frontendPx: `${front.width}/${front.referenceWidth}`,
      editorPx: `${editor.width}/${editor.referenceWidth}`,
      deltaPoints: delta,
      status: ok ? 'OK' : 'MISMATCH',
    });
  }

  console.table(rows);

  if (mismatchCount === 0 && maxLength > 0) {
    console.log(`PARIDAD_EDITOR_FRONTEND_OK: ${maxLength} secciones comparadas, tolerancia ${tolerance} puntos porcentuales.`);
    process.exit(0);
  }

  console.error(
    `PARIDAD_EDITOR_FRONTEND_FALLO: ${mismatchCount} de ${maxLength} secciones no coinciden. ` +
      'Diagnóstico probable: layout.type "constrained" en vez de "default", align:"full" sin la clase ' +
      'de full-bleed del editor, o CSS de página faltante en add_editor_style(); ver ' +
      'references/translation-map.md ("Gotchas concretos de bloques core").',
  );
  process.exit(1);
} catch (error) {
  await browser.close().catch(() => {});
  console.error(`Error ejecutando la comparación: ${error.message}`);
  process.exit(2);
}
