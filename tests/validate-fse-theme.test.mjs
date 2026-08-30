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

test('acepta core/html con un único div vacío (markup decorativo sin contenido editable)', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:html --><div class="grain"></div><!-- /wp:html --></div><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(
    report.errors.some((error) => error.code === 'opaque-html-block'),
    false,
  );
});

test('advierte sobre un core/group sin innerBlocks (debería ser core/html si es decorativo)', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:group {"className":"deco-ring"} --><div class="wp-block-group deco-ring"></div><!-- /wp:group --></div><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.ok(report.warnings.some((warning) => warning.code === 'empty-group-should-be-html'));
});

test('advierte cuando una carpeta de CSS por página no está en add_editor_style()', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  fs.mkdirSync(path.join(themeRoot, 'assets', 'css', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(themeRoot, 'assets', 'css', 'pages', 'home.css'), '.hero-home__title{color:#fff;}\n');
  fs.writeFileSync(
    path.join(themeRoot, 'functions.php'),
    "<?php\nadd_editor_style( array( 'assets/css/tokens.css', 'assets/css/base.css' ) );\n",
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.ok(report.warnings.some((warning) => warning.code === 'page-css-missing-from-editor-styles'));
});

test('no advierte cuando la carpeta de CSS por página sí está representada en add_editor_style()', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  fs.mkdirSync(path.join(themeRoot, 'assets', 'css', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(themeRoot, 'assets', 'css', 'pages', 'home.css'), '.hero-home__title{color:#fff;}\n');
  fs.writeFileSync(
    path.join(themeRoot, 'functions.php'),
    "<?php\nadd_editor_style( array( 'assets/css/tokens.css', 'assets/css/pages/home.css' ) );\n",
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(
    report.warnings.some((warning) => warning.code === 'page-css-missing-from-editor-styles'),
    false,
  );
});

test('no advierte sobre un core/group cuyo único hijo es un bloque autocerrado (ej. wp:post-content)', () => {
  const themeRoot = createTheme(
    '<!-- wp:group {"tagName":"main"} --><main class="wp-block-group">\n<!-- wp:post-content /-->\n</main><!-- /wp:group -->\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(
    report.warnings.some((warning) => warning.code === 'empty-group-should-be-html'),
    false,
  );
});

test('no advierte cuando la carpeta de CSS por página se cubre con glob() dinámico', () => {
  const themeRoot = createTheme(
    '<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n',
  );
  fs.mkdirSync(path.join(themeRoot, 'assets', 'css', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(themeRoot, 'assets', 'css', 'pages', 'home.css'), '.hero-home__title{color:#fff;}\n');
  fs.writeFileSync(
    path.join(themeRoot, 'functions.php'),
    "<?php\n" +
      "function theme_editor_styles() {\n" +
      "  $styles = array( 'assets/css/tokens.css' );\n" +
      "  $page_styles = glob( get_stylesheet_directory() . '/assets/css/pages/*.css' );\n" +
      "  foreach ( (array) $page_styles as $p ) { $styles[] = 'assets/css/pages/' . basename( $p ); }\n" +
      "  add_editor_style( $styles );\n" +
      '}\n',
  );
  const result = spawnSync(process.execPath, [validatorScript, themeRoot], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);

  assert.equal(
    report.warnings.some((warning) => warning.code === 'page-css-missing-from-editor-styles'),
    false,
  );
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
