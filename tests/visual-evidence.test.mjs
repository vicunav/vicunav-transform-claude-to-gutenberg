import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDirectory = path.join(
  repositoryRoot,
  'skills',
  'transform-claude-to-gutenberg',
  'scripts',
);

function writePng(filePath, width, height, color) {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = color[0];
    png.data[index + 1] = color[1];
    png.data[index + 2] = color[2];
    png.data[index + 3] = color[3];
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function createFixture({ targetColor = [20, 40, 60, 255], targetWidth = 2, includeTarget = true } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-evidence-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const sourceCapture = 'evidence/source/home-default-mobile.png';
  const targetCapture = 'evidence/target/home-default-mobile.png';
  const manifest = {
    schemaVersion: 1,
    impact: 'paridad-1-1',
    project: { id: 'demo-test', title: 'Demo test' },
    source: {
      repository: 'organization/source',
      commit: '0123456789abcdef0123456789abcdef01234567',
      installCommand: 'npm ci',
      runCommand: 'npm run dev',
    },
    target: {
      repository: 'organization/target',
      commit: '89abcdef0123456789abcdef0123456789abcdef',
      wordpressVersion: '7.1',
      phpVersion: '8.2',
    },
    environment: {
      browser: 'Chromium',
      browserVersion: '140',
      locale: 'es-VE',
      timezone: 'America/Caracas',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      fonts: ['Body 400'],
    },
    viewports: [{ id: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 }],
    surfaces: [
      {
        id: 'home',
        owner: 'organization/target',
        sourceUrl: 'http://127.0.0.1:4173/',
        targetUrl: 'https://example.local/',
        fixture: 'public-default',
        states: ['default'],
        viewports: ['mobile'],
        capture: { fullPage: true, states: { default: { source: [], target: [] } } },
      },
    ],
    ownership: [{ id: 'global-tokens', kind: 'token', owner: 'organization/theme' }],
    assets: [],
    evidence: [
      {
        surface: 'home',
        state: 'default',
        viewport: 'mobile',
        sourceCapture,
        targetCapture,
        comparisonCapture: 'evidence/comparison/home-default-mobile-side-by-side.png',
        overlayCapture: 'evidence/comparison/home-default-mobile-overlay.png',
        diffCapture: 'evidence/comparison/home-default-mobile-diff.png',
        status: 'pending',
        difference: null,
        approval: null,
        metrics: null,
      },
    ],
    report: { json: 'evidence/visual-report.json', html: 'evidence/visual-report.html' },
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  writePng(path.join(directory, sourceCapture), 2, 2, [20, 40, 60, 255]);
  if (includeTarget) {
    writePng(path.join(directory, targetCapture), targetWidth, 2, targetColor);
  }
  return { directory, manifestPath };
}

function runScript(name, manifestPath, extraArguments = []) {
  return spawnSync(process.execPath, [path.join(scriptsDirectory, name), manifestPath, ...extraArguments], {
    encoding: 'utf8',
  });
}

test('planifica capturas equivalentes sin abrir el navegador', () => {
  const { manifestPath } = createFixture();
  const result = runScript('capture_visual_evidence.mjs', manifestPath, ['--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.captures.length, 2);
  assert.deepEqual(report.captures.map(({ side }) => side), ['source', 'target']);
});

test('captura con Chromium e invalida una comparación anterior', () => {
  const { manifestPath } = createFixture();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const page = encodeURIComponent(
    '<!doctype html><style>html,body,main{margin:0;width:100%;height:100%;background:#14283c}</style><main></main>',
  );
  manifest.surfaces[0].sourceUrl = `data:text/html,${page}`;
  manifest.surfaces[0].capture.fullPage = false;
  manifest.environment.browserVersion = 'auto';
  manifest.evidence[0].status = 'matched';
  manifest.evidence[0].metrics = { exactDifferentPixels: 0 };
  manifest.evidence[0].comparedAt = '2026-08-25T12:00:00.000Z';
  manifest.evidence[0].comparisonCaptureSha256 = 'stale';
  manifest.report.generatedAt = '2026-08-25T12:00:00.000Z';
  manifest.report.jsonSha256 = 'stale';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = runScript('capture_visual_evidence.mjs', manifestPath, ['--side', 'source']);
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(updated.evidence[0].status, 'pending');
  assert.equal(updated.evidence[0].metrics, null);
  assert.equal(updated.evidence[0].comparedAt, undefined);
  assert.equal(updated.report.jsonSha256, undefined);
  assert.match(updated.evidence[0].sourceCaptureSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(updated.environment.browserVersion, 'auto');
});

test('genera artefactos y aprueba el gate para capturas idénticas', () => {
  const { directory, manifestPath } = createFixture();
  const comparison = runScript('compare_visual_evidence.mjs', manifestPath);
  assert.equal(comparison.status, 0, comparison.stderr);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.evidence[0].sourceCapturedAt = '2026-08-25T12:00:00.000Z';
  manifest.evidence[0].targetCapturedAt = '2026-08-25T12:00:01.000Z';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.equal(manifest.evidence[0].status, 'matched');
  assert.equal(manifest.evidence[0].metrics.exactDifferentPixels, 0);
  assert.ok(fs.existsSync(path.join(directory, manifest.report.html)));

  const gate = runScript('verify_visual_evidence.mjs', manifestPath);
  assert.equal(gate.status, 0, gate.stdout || gate.stderr);
  assert.equal(JSON.parse(gate.stdout).valid, true);
});

test('mantiene bloqueada una diferencia visible', () => {
  const { manifestPath } = createFixture({ targetColor: [200, 40, 60, 255] });
  const comparison = runScript('compare_visual_evidence.mjs', manifestPath);
  assert.equal(comparison.status, 0, comparison.stderr);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.evidence[0].status, 'different');
  assert.equal(manifest.evidence[0].metrics.exactDifferentPixels, 4);

  const gate = runScript('verify_visual_evidence.mjs', manifestPath);
  assert.equal(gate.status, 1);
  assert.ok(JSON.parse(gate.stdout).errors.some(({ code }) => code === 'unresolved-evidence'));
});

test('detecta un artefacto alterado después de comparar', () => {
  const { directory, manifestPath } = createFixture();
  assert.equal(runScript('compare_visual_evidence.mjs', manifestPath).status, 0);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.evidence[0].sourceCapturedAt = '2026-08-25T12:00:00.000Z';
  manifest.evidence[0].targetCapturedAt = '2026-08-25T12:00:01.000Z';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.appendFileSync(path.join(directory, manifest.evidence[0].comparisonCapture), 'alterado');

  const gate = runScript('verify_visual_evidence.mjs', manifestPath);
  assert.equal(gate.status, 1);
  assert.ok(JSON.parse(gate.stdout).errors.some(({ code }) => code === 'hash-mismatch'));
});

test('rechaza capturas ausentes o con dimensiones incompatibles', () => {
  const missing = createFixture({ includeTarget: false });
  const missingResult = runScript('compare_visual_evidence.mjs', missing.manifestPath);
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /faltan la captura fuente/);

  const incompatible = createFixture({ targetWidth: 3 });
  const incompatibleResult = runScript('compare_visual_evidence.mjs', incompatible.manifestPath);
  assert.equal(incompatibleResult.status, 1);
  assert.match(incompatibleResult.stderr, /dimensiones incompatibles/);
});
