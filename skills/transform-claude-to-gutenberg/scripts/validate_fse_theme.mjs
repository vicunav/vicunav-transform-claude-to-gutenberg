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

// Recorre el flujo de comentarios de bloque con una pila (igual que
// validateBlockMarkup) para encontrar, por cada core/group, si tiene al
// menos un bloque hijo real. Un core/group con cero innerBlocks dispara el
// placeholder "Group blocks together: Select a layout" del editor aunque el
// bloque sea válido e intencional (ej. un div decorativo .grain/.deco-ring
// sin contenido), eso SÍ es una divergencia visual real entre editor y
// frontend (el frontend nunca muestra ese placeholder). Ver
// translation-map.md, "Gotchas concretos de bloques core".
function findEmptyDecorativeGroups(text) {
  const commentPattern = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)([\s\S]*?)-->/g;
  const events = [];
  let match;
  while ((match = commentPattern.exec(text)) !== null) {
    const closing = match[1] === '/';
    const selfClosing = !closing && /\/\s*$/.test(match[3]);
    events.push({ start: match.index, end: commentPattern.lastIndex, closing, selfClosing, blockName: match[2] });
  }

  const emptyGroups = [];
  const stack = [];
  for (const ev of events) {
    if (!ev.closing && !ev.selfClosing) {
      stack.push({ ev, hasChildBlock: false });
    } else if (ev.selfClosing) {
      // Un hijo autocerrado (ej. <!-- wp:post-content /--> o
      // <!-- wp:spacer /-->) cuenta como contenido real del padre aunque no
      // tenga par de apertura/cierre propio; sin este caso, un core/group
      // que solo envuelve wp:post-content se marcaba, incorrectamente,
      // como "vacío".
      if (stack.length > 0) stack[stack.length - 1].hasChildBlock = true;
    } else if (ev.closing) {
      const top = stack.pop();
      if (!top) continue;
      if (stack.length > 0) stack[stack.length - 1].hasChildBlock = true;
      if (top.ev.blockName === 'group' && !top.hasChildBlock) {
        emptyGroups.push(text.slice(top.ev.start, ev.end));
      }
    }
  }
  return emptyGroups;
}

// Un core/html es la elección correcta para markup decorativo sin
// contenido real (ej. <div class="grain"></div>): no es "esconder contenido
// que debería ser editable", que es lo que este chequeo busca prevenir. Solo
// se marca error cuando el core/html envuelve algo más que un div vacío
// (texto, atributos con contenido real, hijos), que es la señal real de que
// se saltó la traducción a bloques editables.
function findNonDecorativeHtmlBlocks(text) {
  const htmlBlockPattern = /<!--\s*wp:html\s*-->([\s\S]*?)<!--\s*\/wp:html\s*-->/gi;
  const nonDecorative = [];
  for (const match of text.matchAll(htmlBlockPattern)) {
    const inner = match[1].trim();
    const isEmptyDecorativeDiv = /^<div(?:\s+[a-z-]+="[^"]*")*>\s*<\/div>$/i.test(inner);
    if (!isEmptyDecorativeDiv) {
      nonDecorative.push(inner);
    }
  }
  return nonDecorative;
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
const styleCssPath = path.join(themeRoot, 'style.css');
const isChildTheme =
  fs.existsSync(styleCssPath) && /^\s*Template:/m.test(fs.readFileSync(styleCssPath, 'utf8'));
// Un child theme hereda templates/index.html del padre vía el header `Template:` de
// style.css; exigirlo aquí produciría un falso positivo en cada child theme válido.
const requiredFiles = isChildTheme
  ? ['style.css', 'theme.json']
  : ['style.css', 'theme.json', 'templates/index.html'];

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

// El Site Editor / editor de bloques no hereda wp_enqueue_scripts (solo
// frontend); add_editor_style() es la única vía. Un patrón común es un
// array literal de CSS "global" en add_editor_style() más una carpeta de
// CSS condicional por página/plantilla (ej. assets/css/pages/{slug}.css)
// que solo se enqueue en el frontend según is_page()/is_front_page(). Si
// ESA carpeta completa está ausente del array de add_editor_style(), el
// editor nunca ve ningún estilo específico de página (colores, posiciones
// decorativas) aunque el frontend se vea perfecto: un bug de sitio
// completo, no de una sola página, y fácil de no notar porque el CSS base
// (tokens/tipografía/layout compartido) sí carga bien. No se puede resolver
// esto de forma 100% estática porque el nombre del archivo por página suele
// componerse dinámicamente (`'pages/' . $slug . '.css'`), así que el
// chequeo es a nivel de carpeta: si ninguno de los .css de una subcarpeta
// de assets/css aparece en el array de add_editor_style(), es señal fuerte
// de que esa subcarpeta es CSS por-página nunca reflejado en el editor.
const functionsPath = path.join(themeRoot, 'functions.php');
if (fs.existsSync(functionsPath)) {
  const functionsText = fs.readFileSync(functionsPath, 'utf8');
  const editorStyleCalls = [...functionsText.matchAll(/add_editor_style\(([\s\S]*?)\);/g)];
  if (editorStyleCalls.length > 0) {
    const editorStyleText = editorStyleCalls.map((m) => m[1]).join('\n');
    const editorStyleBasenames = new Set(
      [...editorStyleText.matchAll(/['"]([^'"]+\.css)['"]/g)].map((m) => m[1].split('/').pop()),
    );
    const cssRoot = path.join(themeRoot, 'assets', 'css');
    if (fs.existsSync(cssRoot)) {
      const subdirectories = fs
        .readdirSync(cssRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      // Cubrir también el caso recomendado por esta misma advertencia: un
      // glob() sobre la subcarpeta, compuesto dinámicamente en tiempo de
      // ejecución (no aparece como string literal de un archivo concreto).
      const globCalls = [...functionsText.matchAll(/glob\(([\s\S]*?);/g)].map((m) => m[1]);
      for (const subdirectory of subdirectories) {
        const cssFiles = collectFiles(themeRoot, path.join('assets', 'css', subdirectory), new Set(['.css']));
        if (cssFiles.length === 0) continue;
        const noneRepresented = cssFiles.every((file) => !editorStyleBasenames.has(path.basename(file)));
        const coveredByGlob = globCalls.some((call) => call.includes(subdirectory));
        if (noneRepresented && !coveredByGlob) {
          warnings.push({
            file: 'functions.php',
            code: 'page-css-missing-from-editor-styles',
            message: `Ningún archivo de assets/css/${subdirectory}/ aparece en add_editor_style(). Si esta carpeta es CSS condicional por página/plantilla (enqueue dinámico en wp_enqueue_scripts), el editor nunca lo verá; agregar sus archivos (con glob() si el nombre depende del slug) al array de add_editor_style().`,
          });
        }
      }
    }
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

  if (findNonDecorativeHtmlBlocks(text).length > 0) {
    errors.push({
      file: relativePath,
      code: 'opaque-html-block',
      message:
        'Se detectó core/html con contenido real; traducir a bloques editables. (Un core/html con un único div vacío, sin texto ni atributos de contenido, es válido para markup decorativo sin contraparte editable, ej. .grain/.deco-ring/.deco-blob.)',
    });
  }

  // Ver findEmptyDecorativeGroups arriba: un core/group con cero
  // innerBlocks funciona pero produce el placeholder "Select a layout" del
  // editor, una divergencia visual real frente al frontend. No es un error
  // (el bloque es válido) pero sí una señal fuerte para convertirlo a
  // core/html si es puramente decorativo.
  for (const emptyGroupMarkup of findEmptyDecorativeGroups(text)) {
    const classMatch = emptyGroupMarkup.match(/class="([^"]*)"/);
    warnings.push({
      file: relativePath,
      code: 'empty-group-should-be-html',
      message: `core/group sin innerBlocks (clase: "${classMatch ? classMatch[1] : '(sin clase)'}"). Muestra el placeholder "Select a layout" en el editor aunque el frontend no tenga ningún placeholder visible. Si es puramente decorativo (sin contenido editable), usar core/html con el div vacío en vez de core/group.`,
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
