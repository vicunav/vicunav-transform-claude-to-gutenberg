#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function collectFiles(root, directoryName, extensions) {
  const directory = path.join(root, directoryName);
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(absolutePath);
      }
    }
  };
  visit(directory);
  return files.sort((a, b) => a.localeCompare(b));
}

function validateBlockMarkup(text, file, errors) {
  const stack = [];
  const commentPattern = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)([\s\S]*?)-->/gi;

  for (const match of text.matchAll(commentPattern)) {
    const closing = match[1] === '/';
    const blockName = match[2];
    const selfClosing = !closing && /\/\s*$/.test(match[3]);

    if (closing) {
      const expected = stack.pop();
      if (expected !== blockName) {
        errors.push({
          file,
          code: 'block-delimiter-mismatch',
          message: `Se esperaba cerrar ${expected ?? 'ningún bloque'}, pero se cerró ${blockName}.`,
        });
      }
    } else if (!selfClosing) {
      stack.push(blockName);
    }
  }

  for (const blockName of stack.reverse()) {
    errors.push({
      file,
      code: 'unclosed-block',
      message: `El bloque ${blockName} no tiene delimitador de cierre.`,
    });
  }
}

const themeArgument = process.argv[2];
if (!themeArgument) {
  console.error('Uso: node validate_fse_theme.mjs <ruta-theme>');
  process.exit(2);
}

const themeRoot = path.resolve(themeArgument);
if (!fs.existsSync(themeRoot) || !fs.statSync(themeRoot).isDirectory()) {
  console.error(`La ruta del theme no existe o no es un directorio: ${themeRoot}`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const requiredFiles = ['style.css', 'theme.json', 'templates/index.html'];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(themeRoot, relativePath))) {
    errors.push({
      file: relativePath,
      code: 'missing-required-file',
      message: 'Falta un archivo requerido para el block theme.',
    });
  }
}

const themeJsonPath = path.join(themeRoot, 'theme.json');
if (fs.existsSync(themeJsonPath)) {
  try {
    const themeJson = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8'));
    if (![2, 3].includes(themeJson.version)) {
      warnings.push({
        file: 'theme.json',
        code: 'unexpected-theme-json-version',
        message: `Revisar compatibilidad de theme.json version ${String(themeJson.version)} con el WordPress objetivo.`,
      });
    }
    if (!themeJson.settings?.layout?.contentSize || !themeJson.settings?.layout?.wideSize) {
      warnings.push({
        file: 'theme.json',
        code: 'missing-layout-sizes',
        message: 'No se definieron contentSize y wideSize en settings.layout.',
      });
    }
  } catch (error) {
    errors.push({
      file: 'theme.json',
      code: 'invalid-json',
      message: error.message,
    });
  }
}

const stylePath = path.join(themeRoot, 'style.css');
if (fs.existsSync(stylePath)) {
  const style = fs.readFileSync(stylePath, 'utf8');
  if (!/Theme Name\s*:/i.test(style.slice(0, 8192))) {
    errors.push({
      file: 'style.css',
      code: 'missing-theme-name',
      message: 'Falta Theme Name en el encabezado del theme.',
    });
  }
  if (!/Text Domain\s*:/i.test(style.slice(0, 8192))) {
    warnings.push({
      file: 'style.css',
      code: 'missing-text-domain',
      message: 'Falta Text Domain en el encabezado del theme.',
    });
  }
}

const markupFiles = [
  ...collectFiles(themeRoot, 'templates', new Set(['.html'])),
  ...collectFiles(themeRoot, 'parts', new Set(['.html'])),
  ...collectFiles(themeRoot, 'patterns', new Set(['.html', '.php'])),
];

for (const absolutePath of markupFiles) {
  const relativePath = normalizeRelative(themeRoot, absolutePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  const isTemplate = relativePath.startsWith('templates/') && relativePath.endsWith('.html');
  const templateFileName = path.basename(relativePath);

  if (/<!--\s*wp:html(?:\s|\{|\/|-->)/i.test(text)) {
    errors.push({
      file: relativePath,
      code: 'opaque-html-block',
      message: 'Se detectó core/html; traducir el contenido a bloques editables.',
    });
  }
  if (/https?:\/\//i.test(text)) {
    warnings.push({
      file: relativePath,
      code: 'remote-url',
      message: 'Se detectó una URL remota; verificar procedencia, privacidad y disponibilidad local.',
    });
  }
  if (relativePath.startsWith('parts/') && relativePath.split('/').length > 2) {
    errors.push({
      file: relativePath,
      code: 'nested-template-part',
      message: 'Los template parts no deben estar dentro de subdirectorios.',
    });
  }

  // Un template page-{slug}.html o single-{cpt}.html que no usa
  // wp:post-content casi siempre significa que el contenido único de esa
  // página quedó hardcodeado en el template en vez de vivir en el
  // post_content real: el post/página queda vacío e ineditable desde su
  // propio editor o desde el Site Editor, aunque el frontend renderice
  // bien. Ver references/translation-map.md, sección "Contenido de página
  // vs. contenido de template".
  const looksLikeSingleContentTemplate =
    /^(page|single)(-|\.html$)/.test(templateFileName) && templateFileName !== 'page.html' && templateFileName !== 'single.html';
  if (isTemplate && looksLikeSingleContentTemplate && !/<!--\s*wp:post-content(?:\s|\{|\/|-->)/i.test(text)) {
    errors.push({
      file: relativePath,
      code: 'page-content-hardcoded-in-template',
      message:
        'Este template parece exclusivo de una sola página/post pero no usa wp:post-content. Verificar que el contenido único viva en el post_content real, no hardcodeado aquí; el template debe limitarse al chrome compartido (header/footer) salvo justificación explícita.',
    });
  }

  // Un comentario HTML que no es un delimitador de bloque (no empieza con
  // wp:/-wp:) rompe el parser de WordPress si vive dentro de un bloque
  // (ej. <!-- TODO: ... --> dentro de un core/group). Se permite solo como
  // primera línea del archivo, donde este proyecto usa la cita de fuente
  // ("Fuente: docs/.../Componente.dc.html, líneas X-Y").
  const firstLine = text.split('\n', 1)[0] ?? '';
  const bodyAfterFirstLine = text.slice(firstLine.length);
  const strayCommentPattern = /<!--(?!\s*\/?wp:)([\s\S]*?)-->/g;
  for (const match of bodyAfterFirstLine.matchAll(strayCommentPattern)) {
    errors.push({
      file: relativePath,
      code: 'non-block-comment',
      message: `Comentario HTML que no es delimitador de bloque fuera de la primera línea: "${match[1].trim().slice(0, 80)}". Elimínalo o conviértelo en bloque; rompe el parser si queda dentro de un core/group.`,
    });
  }

  // "constrained" clampea los hijos al contentSize de theme.json (pensado
  // para columnas de lectura tipo blog). Usarlo en una sección full-bleed
  // produce el bug de "contenedor angosto". No es un error automático
  // porque a veces es la elección correcta: revisar manualmente.
  if (/"type":"constrained"/.test(text)) {
    warnings.push({
      file: relativePath,
      code: 'constrained-layout-type',
      message:
        'layout.type "constrained" clampea al contentSize de theme.json. Confirmar que es intencional (columna de lectura) y no una sección full-bleed que debería usar "default".',
    });
  }

  // El className de un core/query casi nunca aplica donde se espera: el
  // grid real está en el <ul> que renderiza core/post-template, no en el
  // <div> del core/query. Poner ahí la clase de grid rompe el layout de
  // tarjetas aunque el bloque valide bien.
  const queryCommentHasClassName = [...text.matchAll(/<!--\s*wp:query\b[\s\S]*?-->/gi)].some((m) =>
    /"className"/.test(m[0]),
  );
  const postTemplateCommentHasClassName = [...text.matchAll(/<!--\s*wp:post-template\b[\s\S]*?-->/gi)].some((m) =>
    /"className"/.test(m[0]),
  );
  if (queryCommentHasClassName && !postTemplateCommentHasClassName) {
    warnings.push({
      file: relativePath,
      code: 'query-classname-should-be-on-post-template',
      message:
        'className en core/query probablemente debería estar en core/post-template (el <ul> que WordPress genera para el Query Loop es el contenedor real de la grilla, no el <div> de core/query).',
    });
  }

  validateBlockMarkup(text, relativePath, errors);
}

const report = {
  themeRoot,
  valid: errors.length === 0,
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    markupFiles: markupFiles.length,
  },
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
