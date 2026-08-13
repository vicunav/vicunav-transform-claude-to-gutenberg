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
