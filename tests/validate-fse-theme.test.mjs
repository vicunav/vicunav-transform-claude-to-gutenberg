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

function writeExtraTemplate(themeRoot, fileName, content) {
  fs.writeFileSync(path.join(themeRoot, 'templates', fileName), content);
}

test('rechaza un page-{slug}.html sin wp:post-content (contenido hardcodeado en el template)', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  writeExtraTemplate(
    themeRoot,
    'page-servicios.html',
    '<!-- wp:template-part {"slug":"header"} /-->\n<!-- wp:group --><main><!-- wp:paragraph --><p>Copy único de Servicios, nunca editable desde la página</p><!-- /wp:paragraph --></main><!-- /wp:group -->\n<!-- wp:template-part {"slug":"footer"} /-->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === 'page-content-hardcoded-in-template'));
});

test('acepta page.html genérico que usa wp:post-content', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  writeExtraTemplate(
    themeRoot,
    'page.html',
    '<!-- wp:template-part {"slug":"header"} /-->\n<!-- wp:group {"tagName":"main"} --><main><!-- wp:post-content /--></main><!-- /wp:group -->\n<!-- wp:template-part {"slug":"footer"} /-->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(
    report.errors.some((error) => error.code === 'page-content-hardcoded-in-template'),
    false,
  );
});

test('rechaza un comentario HTML que no es delimitador de bloque fuera de la primera línea', () => {
  const themeRoot = createTheme(
    '<!-- Fuente: docs/Componente.dc.html, líneas 1-10 -->\n<!-- wp:group --><div class="wp-block-group">\n<!-- TODO: brand dot decorativo -->\n<!-- wp:paragraph --><p>Texto</p><!-- /wp:paragraph -->\n</div><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === 'non-block-comment'));
});

test('advierte sobre layout.type constrained y className de core/query mal ubicado', () => {
  const themeRoot = createTheme(
    '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group">\n' +
      '<!-- wp:query {"query":{"postType":"post"},"className":"articulos-grid"} --><div class="wp-block-query">\n' +
      '<!-- wp:post-template --><!-- /wp:post-template -->\n' +
      '</div><!-- /wp:query -->\n' +
      '</div><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.ok(report.warnings.some((warning) => warning.code === 'constrained-layout-type'));
  assert.ok(report.warnings.some((warning) => warning.code === 'query-classname-should-be-on-post-template'));
});
