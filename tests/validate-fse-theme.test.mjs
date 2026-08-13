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
  'validate_fse_theme.mjs',
);

function createTheme(template) {
  const themeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fse-theme-'));
  fs.mkdirSync(path.join(themeRoot, 'templates'));
  fs.writeFileSync(
    path.join(themeRoot, 'style.css'),
    '/*\nTheme Name: Fixture\nText Domain: fixture\n*/\n',
  );
  fs.writeFileSync(
    path.join(themeRoot, 'theme.json'),
    JSON.stringify({
      version: 3,
      settings: { layout: { contentSize: '720px', wideSize: '1200px' } },
    }),
  );
  fs.writeFileSync(path.join(themeRoot, 'templates', 'index.html'), template);
  return themeRoot;
}

test('aprueba un block theme FSE mínimo y editable', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Contenido</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.summary.errors, 0);
});

test('rechaza core/html y delimitadores de bloques desbalanceados', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:html --><div>Opaco</div><!-- /wp:html --></div>\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  assert.equal(result.status, 1);

  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === 'opaque-html-block'));
  assert.ok(report.errors.some((error) => error.code === 'unclosed-block'));
});
