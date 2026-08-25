import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export function loadManifest(argument) {
  if (!argument) {
    throw new Error('Debe indicar la ruta del manifiesto.');
  }
  const manifestPath = path.resolve(argument);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifest, manifestPath, baseDirectory: path.dirname(manifestPath) };
}

export function saveManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function evidenceKey(item) {
  return `${item.surface}|${item.state}|${item.viewport}`;
}

export function safePath(baseDirectory, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) {
    throw new Error(`Ruta de evidencia inválida: ${String(relativePath)}`);
  }
  const resolved = path.resolve(baseDirectory, relativePath);
  const relative = path.relative(baseDirectory, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`La ruta escapa del directorio del manifiesto: ${relativePath}`);
  }
  return resolved;
}

export function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

export function writePng(filePath, png) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

export function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function assertSameDimensions(source, target, key) {
  if (source.width !== target.width || source.height !== target.height) {
    throw new Error(
      `${key}: dimensiones incompatibles (${source.width}x${source.height} y ${target.width}x${target.height}).`,
    );
  }
}

export function createSideBySide(source, target, gap = 16) {
  const output = new PNG({ width: source.width * 2 + gap, height: source.height });
  output.data.fill(255);
  PNG.bitblt(source, output, 0, 0, source.width, source.height, 0, 0);
  PNG.bitblt(target, output, 0, 0, target.width, target.height, source.width + gap, 0);
  return output;
}

export function createOverlay(source, target) {
  const output = new PNG({ width: source.width, height: source.height });
  for (let index = 0; index < output.data.length; index += 4) {
    output.data[index] = Math.round((source.data[index] + target.data[index]) / 2);
    output.data[index + 1] = Math.round((source.data[index + 1] + target.data[index + 1]) / 2);
    output.data[index + 2] = Math.round((source.data[index + 2] + target.data[index + 2]) / 2);
    output.data[index + 3] = Math.round((source.data[index + 3] + target.data[index + 3]) / 2);
  }
  return output;
}

export function countExactDifferences(source, target) {
  let differentPixels = 0;
  for (let index = 0; index < source.data.length; index += 4) {
    if (
      source.data[index] !== target.data[index] ||
      source.data[index + 1] !== target.data[index + 1] ||
      source.data[index + 2] !== target.data[index + 2] ||
      source.data[index + 3] !== target.data[index + 3]
    ) {
      differentPixels += 1;
    }
  }
  return differentPixels;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function relativeForHtml(htmlPath, assetPath) {
  return path.relative(path.dirname(htmlPath), assetPath).split(path.sep).join('/');
}

export function parseOptions(argumentsList) {
  const positional = [];
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const [name, inlineValue] = argument.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options.set(name, inlineValue);
    } else if (argumentsList[index + 1] && !argumentsList[index + 1].startsWith('--')) {
      options.set(name, argumentsList[index + 1]);
      index += 1;
    } else {
      options.set(name, true);
    }
  }
  return { positional, options };
}
