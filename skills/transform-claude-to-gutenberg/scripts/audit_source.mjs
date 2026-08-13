#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXCLUDED_DIRS = new Set([
  '.cache', '.git', '.next', '.nuxt', '.output', '.turbo', '.vercel', 'build',
  'coverage', 'dist', 'generated', 'node_modules', 'out', 'playwright-report',
  'storybook-static', 'test-results', 'vendor',
]);
const SOURCE_EXTENSIONS = new Set([
  '.astro', '.css', '.htm', '.html', '.js', '.jsx', '.mdx', '.scss', '.ts', '.tsx', '.vue',
]);
const ASSET_EXTENSIONS = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp', '.woff', '.woff2',
]);
const MAX_FILE_BYTES = 512 * 1024;

function printUsage() {
  console.error('Uso: node audit_source.mjs <ruta-fuente>');
}

function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function walk(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.storybook') {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walk(root, absolutePath, files);
      }
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function readText(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_BYTES) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function isTestOrFixture(file) {
  return /(^|\/)(?:__tests__|e2e|fixtures?|tests?)\//i.test(file)
    || /\.(?:spec|stories|test)\.[^.]+$/i.test(file);
}

function detectFramework(packageJson) {
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };
  const candidates = [
    ['next', 'Next.js'],
    ['@remix-run/react', 'Remix'],
    ['astro', 'Astro'],
    ['nuxt', 'Nuxt'],
    ['vue', 'Vue'],
    ['react', 'React'],
    ['vite', 'Vite'],
  ];

  return candidates
    .filter(([packageName]) => packageName in dependencies)
    .map(([, label]) => label);
}

function findRoutes(relativeFiles) {
  const routes = [];
  const routePatterns = [
    /^(?:src\/)?app\/(.+\/)?page\.(?:js|jsx|ts|tsx)$/,
    /^(?:src\/)?pages\/(.+)\.(?:js|jsx|ts|tsx|mdx)$/,
    /^(?:src\/)?pages\/(.+)\.(?:astro|vue)$/,
  ];

  for (const file of relativeFiles) {
    if (routePatterns.some((pattern) => pattern.test(file)) || file.endsWith('.html')) {
      routes.push(file);
    }
  }
  return uniqueSorted(routes);
}

function extractCssSignals(cssFiles, root) {
  const customProperties = [];
  const colors = [];
  const fontFamilies = [];

  for (const file of cssFiles) {
    const text = readText(path.join(root, file));
    if (text === null) {
      continue;
    }

    for (const match of text.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
      customProperties.push(match[1]);
    }
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/g)) {
      colors.push(match[0]);
    }
    for (const match of text.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      fontFamilies.push(match[1].trim());
    }
  }

  return {
    customProperties: uniqueSorted(customProperties),
    colorLiterals: uniqueSorted(colors),
    fontFamilies: uniqueSorted(fontFamilies),
  };
}

function detectInteractiveSignals(sourceFiles, root) {
  const patterns = {
    dataFetching: /\bfetch\s*\(|\baxios\b|\buseSWR\b|\buseQuery\b/,
    eventHandlers: /\bon(?:Click|Change|Submit|KeyDown|MouseEnter)\s*=/,
    forms: /<form\b|\buseForm\b|\bFormData\b/,
    maps: /\b(?:google\.maps|mapbox|leaflet)\b/i,
    media: /<(?:video|audio)\b|\bYouTube\b|\bVimeo\b/i,
    reactState: /\buseState\s*\(|\buseReducer\s*\(/,
    sliders: /\b(?:swiper|splide|embla|carousel)\b/i,
  };
  const findings = Object.fromEntries(Object.keys(patterns).map((key) => [key, []]));

  for (const file of sourceFiles) {
    const text = readText(path.join(root, file));
    if (text === null) {
      continue;
    }
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        findings[key].push(file);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(findings)
      .filter(([, files]) => files.length > 0)
      .map(([key, files]) => [key, uniqueSorted(files)]),
  );
}

const sourceArgument = process.argv[2];
if (!sourceArgument) {
  printUsage();
  process.exit(2);
}

const sourceRoot = path.resolve(sourceArgument);
if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
  console.error(`La ruta fuente no existe o no es un directorio: ${sourceRoot}`);
  process.exit(2);
}

let packageJson = null;
const packagePath = path.join(sourceRoot, 'package.json');
if (fs.existsSync(packagePath)) {
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    console.error(`package.json inválido: ${error.message}`);
    process.exit(1);
  }
}

const absoluteFiles = walk(sourceRoot);
const relativeFiles = absoluteFiles.map((file) => normalizeRelative(sourceRoot, file));
const sourceFiles = relativeFiles.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()));
const analysisSourceFiles = sourceFiles.filter((file) => !isTestOrFixture(file));
const cssFiles = sourceFiles.filter((file) => ['.css', '.scss'].includes(path.extname(file).toLowerCase()));
const assets = relativeFiles.filter((file) => ASSET_EXTENSIONS.has(path.extname(file).toLowerCase()));
const componentFiles = analysisSourceFiles.filter((file) =>
  /(^|\/)(components?|ui)\//i.test(file) || /[A-Z][A-Za-z0-9_-]*\.(?:jsx?|tsx?|vue)$/.test(file),
);

const report = {
  sourceRoot,
  packageManager: fs.existsSync(path.join(sourceRoot, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : fs.existsSync(path.join(sourceRoot, 'yarn.lock'))
      ? 'yarn'
      : fs.existsSync(path.join(sourceRoot, 'bun.lockb')) || fs.existsSync(path.join(sourceRoot, 'bun.lock'))
        ? 'bun'
        : fs.existsSync(path.join(sourceRoot, 'package-lock.json'))
          ? 'npm'
          : null,
  frameworks: detectFramework(packageJson),
  scripts: packageJson?.scripts ?? {},
  dependencies: Object.keys(packageJson?.dependencies ?? {}).sort(),
  routes: findRoutes(relativeFiles),
  components: uniqueSorted(componentFiles),
  stylesheets: uniqueSorted(cssFiles),
  assets: uniqueSorted(assets),
  cssSignals: extractCssSignals(cssFiles, sourceRoot),
  interactiveSignals: detectInteractiveSignals(analysisSourceFiles, sourceRoot),
  counts: {
    files: relativeFiles.length,
    sourceFiles: sourceFiles.length,
    assets: assets.length,
  },
  notes: [
    'El reporte es heurístico y debe verificarse contra el frontend renderizado.',
    'Los directorios de dependencias, builds, cobertura y control de versiones fueron excluidos.',
    'Los archivos mayores de 512 KiB no fueron leídos para extraer señales.',
  ],
};

console.log(JSON.stringify(report, null, 2));
