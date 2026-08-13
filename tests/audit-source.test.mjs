import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditScript = path.join(
  repositoryRoot,
  'skills',
  'transform-claude-to-gutenberg',
  'scripts',
  'audit_source.mjs',
);

test('audita un proyecto Next.js sin mezclar tests ni código generado', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-source-'));
  fs.mkdirSync(path.join(fixtureRoot, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'src', 'generated'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify({
      scripts: { dev: 'next dev', build: 'next build' },
      dependencies: { next: '16.0.0', react: '19.0.0' },
    }),
  );
  fs.writeFileSync(path.join(fixtureRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  fs.writeFileSync(
    path.join(fixtureRoot, 'src', 'app', 'page.tsx'),
    'export default function Page() { return <form onSubmit={() => undefined} />; }\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'src', 'app', 'globals.css'),
    ':root { --brand: #123456; } body { font-family: Georgia, serif; }\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'src', 'components', 'Menu.tsx'),
    'export function Menu() { return null; }\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'src', 'components', 'Menu.test.tsx'),
    'throw new Error("fixture");\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'src', 'generated', 'Client.ts'),
    'export const generated = true;\n',
  );

  const result = spawnSync(process.execPath, [auditScript, fixtureRoot], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.frameworks, ['Next.js', 'React']);
  assert.equal(report.packageManager, 'pnpm');
  assert.deepEqual(report.routes, ['src/app/page.tsx']);
  assert.deepEqual(report.components, ['src/components/Menu.tsx']);
  assert.deepEqual(report.cssSignals.customProperties, ['--brand']);
  assert.deepEqual(report.cssSignals.colorLiterals, ['#123456']);
  assert.ok(report.interactiveSignals.forms.includes('src/app/page.tsx'));
  assert.ok(!JSON.stringify(report).includes('Menu.test.tsx'));
  assert.ok(!JSON.stringify(report).includes('generated/Client.ts'));
});

test('rechaza una ruta fuente inexistente', () => {
  const result = spawnSync(process.execPath, [auditScript, '/tmp/source-that-does-not-exist'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /no existe/i);
});
