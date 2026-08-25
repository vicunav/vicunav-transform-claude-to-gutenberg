#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  assertSameDimensions,
  countExactDifferences,
  createOverlay,
  createSideBySide,
  ensureParent,
  escapeHtml,
  evidenceKey,
  loadManifest,
  parseOptions,
  readPng,
  relativeForHtml,
  safePath,
  saveManifest,
  sha256,
  writePng,
} from './visual_evidence_lib.mjs';

const { positional, options } = parseOptions(process.argv.slice(2));
const threshold = Number(options.get('threshold') ?? 0.1);

if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  console.error('`--threshold` debe ser un número entre 0 y 1.');
  process.exit(2);
}

function renderHtml(report, htmlPath, baseDirectory) {
  const cards = report.evidence
    .map((item) => {
      const source = relativeForHtml(htmlPath, safePath(baseDirectory, item.paths.source));
      const target = relativeForHtml(htmlPath, safePath(baseDirectory, item.paths.target));
      const sideBySide = relativeForHtml(htmlPath, safePath(baseDirectory, item.paths.sideBySide));
      const overlay = relativeForHtml(htmlPath, safePath(baseDirectory, item.paths.overlay));
      const diff = relativeForHtml(htmlPath, safePath(baseDirectory, item.paths.diff));
      return `<article>
  <h2>${escapeHtml(item.key)}</h2>
  <p><strong>Estado:</strong> ${escapeHtml(item.status)} · <strong>Diferencia exacta:</strong> ${escapeHtml(
        `${(item.metrics.exactDifferenceRatio * 100).toFixed(4)}%`,
      )}</p>
  <div class="grid">
    <figure><img src="${escapeHtml(source)}" alt="Fuente ${escapeHtml(item.key)}"><figcaption>Fuente</figcaption></figure>
    <figure><img src="${escapeHtml(target)}" alt="Objetivo ${escapeHtml(item.key)}"><figcaption>Objetivo</figcaption></figure>
    <figure><img src="${escapeHtml(sideBySide)}" alt="Lado a lado ${escapeHtml(item.key)}"><figcaption>Lado a lado</figcaption></figure>
    <figure><img src="${escapeHtml(overlay)}" alt="Overlay ${escapeHtml(item.key)}"><figcaption>Overlay</figcaption></figure>
    <figure><img src="${escapeHtml(diff)}" alt="Diff ${escapeHtml(item.key)}"><figcaption>Diff perceptual</figcaption></figure>
  </div>
</article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte de evidencia visual</title>
  <style>
    body { color: #18181b; font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 1600px; padding: 2rem; }
    article { border-top: 1px solid #d4d4d8; margin-top: 2rem; padding-top: 1rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    figure { margin: 0; }
    img { border: 1px solid #a1a1aa; display: block; height: auto; max-width: 100%; }
    figcaption { font-weight: 600; margin-top: .5rem; }
  </style>
</head>
<body>
  <h1>Reporte de evidencia visual</h1>
  <p>Generado: ${escapeHtml(report.generatedAt)} · Filas: ${report.summary.rows} · Diferentes: ${report.summary.different}</p>
  ${cards}
</body>
</html>
`;
}

try {
  const { manifest, manifestPath, baseDirectory } = loadManifest(positional[0]);
  if (!manifest.report?.json || !manifest.report?.html) {
    throw new Error('El manifiesto debe declarar report.json y report.html.');
  }
  const reportRows = [];
  for (const row of manifest.evidence) {
    const key = evidenceKey(row);
    const sourcePath = safePath(baseDirectory, row.sourceCapture);
    const targetPath = safePath(baseDirectory, row.targetCapture);
    if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
      throw new Error(`${key}: faltan la captura fuente o la captura objetivo.`);
    }
    const source = readPng(sourcePath);
    const target = readPng(targetPath);
    assertSameDimensions(source, target, key);

    const diff = new PNG({ width: source.width, height: source.height });
    const perceptualDifferentPixels = pixelmatch(source.data, target.data, diff.data, source.width, source.height, {
      threshold,
      includeAA: false,
    });
    const exactDifferentPixels = countExactDifferences(source, target);
    const pixels = source.width * source.height;
    const sideBySidePath = safePath(baseDirectory, row.comparisonCapture);
    const overlayPath = safePath(baseDirectory, row.overlayCapture);
    const diffPath = safePath(baseDirectory, row.diffCapture);
    writePng(sideBySidePath, createSideBySide(source, target));
    writePng(overlayPath, createOverlay(source, target));
    writePng(diffPath, diff);

    row.sourceCaptureSha256 = sha256(sourcePath);
    row.targetCaptureSha256 = sha256(targetPath);
    row.comparisonCaptureSha256 = sha256(sideBySidePath);
    row.overlayCaptureSha256 = sha256(overlayPath);
    row.diffCaptureSha256 = sha256(diffPath);
    row.comparedAt = new Date().toISOString();
    row.metrics = {
      width: source.width,
      height: source.height,
      pixels,
      exactDifferentPixels,
      exactDifferenceRatio: exactDifferentPixels / pixels,
      perceptualDifferentPixels,
      perceptualDifferenceRatio: perceptualDifferentPixels / pixels,
      perceptualThreshold: threshold,
    };
    if (exactDifferentPixels === 0) {
      row.status = 'matched';
      row.difference = null;
      row.approval = null;
    } else if (row.status !== 'approved-difference') {
      row.status = 'different';
    }
    reportRows.push({
      key,
      status: row.status,
      paths: {
        source: row.sourceCapture,
        target: row.targetCapture,
        sideBySide: row.comparisonCapture,
        overlay: row.overlayCapture,
        diff: row.diffCapture,
      },
      metrics: row.metrics,
    });
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCommit: manifest.source.commit,
    targetCommit: manifest.target.commit,
    summary: {
      rows: reportRows.length,
      matched: reportRows.filter(({ status }) => status === 'matched').length,
      different: reportRows.filter(({ status }) => status === 'different').length,
      approvedDifferences: reportRows.filter(({ status }) => status === 'approved-difference').length,
    },
    evidence: reportRows,
  };
  const jsonPath = safePath(baseDirectory, manifest.report.json);
  const htmlPath = safePath(baseDirectory, manifest.report.html);
  ensureParent(jsonPath);
  ensureParent(htmlPath);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(htmlPath, renderHtml(report, htmlPath, baseDirectory));
  manifest.report.generatedAt = report.generatedAt;
  manifest.report.jsonSha256 = sha256(jsonPath);
  manifest.report.htmlSha256 = sha256(htmlPath);
  saveManifest(manifestPath, manifest);
  console.log(JSON.stringify({ valid: true, manifestPath, report }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, error: error.message }, null, 2));
  process.exit(1);
}
