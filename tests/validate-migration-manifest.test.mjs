import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validatorScript = path.join(
  repositoryRoot,
  'skills',
  'transform-claude-to-gutenberg',
  'scripts',
  'validate_migration_manifest.mjs',
);

function createManifest() {
  const viewports = [
    { id: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1 },
    { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
  ];
  const states = ['default', 'expanded'];
  return {
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
      commit: null,
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
      fonts: ['Display 800', 'Body 400'],
    },
    viewports,
    surfaces: [
      {
        id: 'home',
        owner: 'organization/target',
        sourceUrl: 'http://127.0.0.1:5173/',
        targetUrl: 'https://example.local/',
      fixture: 'public-default',
      states,
      viewports: viewports.map(({ id }) => id),
      capture: {
        fullPage: true,
        readySelector: 'main',
        states: Object.fromEntries(states.map((state) => [state, { source: [], target: [] }])),
      },
      },
    ],
    ownership: [{ id: 'global-tokens', kind: 'token', owner: 'organization/theme' }],
    assets: [
      {
        id: 'hero',
        status: 'available',
        owner: 'organization/target',
        source: 'assets/hero.webp',
        license: 'documented',
      },
    ],
    evidence: states.flatMap((state) =>
      viewports.map(({ id: viewport }) => ({
        surface: 'home',
        state,
        viewport,
        sourceCapture: `evidence/source/home-${state}-${viewport}.png`,
        targetCapture: `evidence/target/home-${state}-${viewport}.png`,
        comparisonCapture: `evidence/comparison/home-${state}-${viewport}-side-by-side.png`,
        overlayCapture: `evidence/comparison/home-${state}-${viewport}-overlay.png`,
        diffCapture: `evidence/comparison/home-${state}-${viewport}-diff.png`,
        status: 'pending',
        difference: null,
        approval: null,
      })),
    ),
    report: {
      json: 'evidence/visual-report.json',
      html: 'evidence/visual-report.html',
    },
  };
}

function runValidator(manifest) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-manifest-'));
  const manifestPath = path.join(directory, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return spawnSync(process.execPath, [validatorScript, manifestPath], { encoding: 'utf8' });
}

test('aprueba un contrato con matriz completa y commit objetivo pendiente', () => {
  const result = runValidator(createManifest());
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.summary.expectedEvidence, 4);
  assert.equal(report.summary.indexedEvidence, 4);
  assert.ok(report.warnings.some(({ code }) => code === 'pending-target-commit'));
});

test('rechaza una raíz JSON inválida sin interrumpir el reporte', () => {
  const result = runValidator(null);
  assert.equal(result.status, 1);

  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some(({ code }) => code === 'invalid-root'));
});

test('rechaza IDs duplicados y una combinación de evidencia ausente', () => {
  const manifest = createManifest();
  manifest.viewports.push({ ...manifest.viewports[0] });
  manifest.evidence.pop();

  const result = runValidator(manifest);
  assert.equal(result.status, 1);

  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some(({ code }) => code === 'duplicate-id'));
  assert.ok(report.errors.some(({ code }) => code === 'missing-evidence'));
});

test('rechaza rutas personales y diferencias aprobadas sin aprobación', () => {
  const manifest = createManifest();
  const privateRoot = ['', 'Users', 'example', 'private'].join('/');
  manifest.source.repository = `${privateRoot}/source`;
  manifest.evidence[0].sourceCapture = `${privateRoot}/source.png`;
  manifest.evidence[0].status = 'approved-difference';
  manifest.evidence[0].difference = '';

  const result = runValidator(manifest);
  assert.equal(result.status, 1);

  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some(({ code }) => code === 'private-path'));
  assert.ok(report.errors.some(({ code }) => code === 'unsafe-evidence-path'));
  assert.ok(report.errors.some(({ code }) => code === 'required-difference'));
  assert.ok(report.errors.some(({ code }) => code === 'required-approval'));
});
