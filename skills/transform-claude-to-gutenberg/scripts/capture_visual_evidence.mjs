#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';
import {
  ensureParent,
  evidenceKey,
  loadManifest,
  parseOptions,
  safePath,
  saveManifest,
  sha256,
} from './visual_evidence_lib.mjs';

const { positional, options } = parseOptions(process.argv.slice(2));
const sideOption = options.get('side') ?? 'both';

if (!['source', 'target', 'both'].includes(sideOption)) {
  console.error('`--side` debe ser source, target o both.');
  process.exit(2);
}

function buildPlan(manifest) {
  const surfaces = new Map(manifest.surfaces.map((surface) => [surface.id, surface]));
  const viewports = new Map(manifest.viewports.map((viewport) => [viewport.id, viewport]));
  const sides = sideOption === 'both' ? ['source', 'target'] : [sideOption];
  return manifest.evidence.flatMap((evidence) =>
    sides.map((side) => {
      const surface = surfaces.get(evidence.surface);
      const viewport = viewports.get(evidence.viewport);
      if (!surface || !viewport) {
        throw new Error(`${evidenceKey(evidence)}: referencia una superficie o viewport inexistente.`);
      }
      return {
        key: evidenceKey(evidence),
        side,
        url: surface[`${side}Url`],
        output: evidence[`${side}Capture`],
        viewport,
        capture: surface.capture ?? {},
        actions: surface.capture?.states?.[evidence.state]?.[side] ?? null,
      };
    }),
  );
}

async function runAction(page, action, key) {
  if (!action || typeof action !== 'object') {
    throw new Error(`${key}: acción de captura inválida.`);
  }
  const locator = action.selector ? page.locator(action.selector).first() : null;
  switch (action.action) {
    case 'click':
      await locator.click();
      break;
    case 'hover':
      await locator.hover();
      break;
    case 'focus':
      await locator.focus();
      break;
    case 'fill':
      await locator.fill(String(action.value ?? ''));
      break;
    case 'press':
      await locator.press(String(action.key ?? ''));
      break;
    case 'wait-for':
      await locator.waitFor({ state: action.state ?? 'visible' });
      break;
    case 'wait':
      await page.waitForTimeout(Number(action.milliseconds ?? 0));
      break;
    case 'scroll':
      if (locator) {
        await locator.scrollIntoViewIfNeeded();
      } else {
        await page.evaluate(
          ({ x, y }) => window.scrollTo(x, y),
          { x: Number(action.x ?? 0), y: Number(action.y ?? 0) },
        );
      }
      break;
    default:
      throw new Error(`${key}: acción no admitida: ${String(action.action)}.`);
  }
}

async function captureItem(browser, item, environment, baseDirectory) {
  if (!Array.isArray(item.actions)) {
    throw new Error(`${item.key}: debe declarar capture.states para ${item.side}.`);
  }
  const storageStateOption = options.get(`storage-state-${item.side}`);
  const context = await browser.newContext({
    viewport: { width: item.viewport.width, height: item.viewport.height },
    deviceScaleFactor: item.viewport.deviceScaleFactor,
    locale: environment.locale,
    timezoneId: environment.timezone,
    colorScheme: environment.colorScheme,
    reducedMotion: environment.reducedMotion,
    ignoreHTTPSErrors: Boolean(environment.ignoreHTTPSErrors),
    storageState: storageStateOption ? fs.realpathSync(String(storageStateOption)) : undefined,
  });
  const page = await context.newPage();
  try {
    await page.goto(item.url, {
      waitUntil: item.capture.waitUntil ?? 'networkidle',
      timeout: Number(item.capture.timeoutMs ?? 30000),
    });
    if (item.capture.readySelector) {
      await page.locator(item.capture.readySelector).first().waitFor({ state: 'visible' });
    }
    for (const action of item.actions) {
      await runAction(page, action, item.key);
    }
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    const output = safePath(baseDirectory, item.output);
    ensureParent(output);
    await page.screenshot({ path: output, fullPage: item.capture.fullPage !== false });
    return { output, capturedAt: new Date().toISOString(), hash: sha256(output) };
  } finally {
    await context.close();
  }
}

let browser;
try {
  const { manifest, manifestPath, baseDirectory } = loadManifest(positional[0]);
  const plan = buildPlan(manifest);
  if (options.has('dry-run')) {
    console.log(JSON.stringify({ valid: true, manifestPath, captures: plan }, null, 2));
    process.exit(0);
  }

  browser = await chromium.launch({ headless: !options.has('headed') });
  const actualBrowserVersion = browser.version();
  if (String(manifest.environment.browser).toLowerCase() !== 'chromium') {
    throw new Error('Este capturador solo admite Chromium.');
  }
  if (manifest.environment.browserVersion === 'auto') {
    manifest.environment.browserVersion = actualBrowserVersion;
  } else if (
    actualBrowserVersion !== manifest.environment.browserVersion &&
    !actualBrowserVersion.startsWith(`${manifest.environment.browserVersion}.`)
  ) {
    throw new Error(
      `La versión real de Chromium (${actualBrowserVersion}) no coincide con la declarada (${manifest.environment.browserVersion}).`,
    );
  }
  const evidence = new Map(manifest.evidence.map((item) => [evidenceKey(item), item]));
  const results = [];
  for (const item of plan) {
    const result = await captureItem(browser, item, manifest.environment, baseDirectory);
    const row = evidence.get(item.key);
    row[`${item.side}CapturedAt`] = result.capturedAt;
    row[`${item.side}CaptureSha256`] = result.hash;
    row.status = 'pending';
    row.difference = null;
    row.approval = null;
    row.metrics = null;
    for (const field of [
      'comparedAt',
      'comparisonCaptureSha256',
      'overlayCaptureSha256',
      'diffCaptureSha256',
    ]) {
      delete row[field];
    }
    results.push({ key: item.key, side: item.side, path: item.output, sha256: result.hash });
  }
  delete manifest.report.generatedAt;
  delete manifest.report.jsonSha256;
  delete manifest.report.htmlSha256;
  saveManifest(manifestPath, manifest);
  console.log(JSON.stringify({ valid: true, manifestPath, captures: results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
