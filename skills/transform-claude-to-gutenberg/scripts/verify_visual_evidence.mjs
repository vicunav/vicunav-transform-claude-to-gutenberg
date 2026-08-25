#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evidenceKey, loadManifest, safePath, sha256 } from './visual_evidence_lib.mjs';

const manifestArgument = process.argv[2];
const validatorPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'validate_migration_manifest.mjs');
const structural = spawnSync(process.execPath, [validatorPath, manifestArgument ?? ''], { encoding: 'utf8' });

if (structural.status !== 0) {
  let details = structural.stdout || structural.stderr;
  try {
    details = JSON.parse(structural.stdout);
  } catch {
    // Conservar el diagnóstico textual del validador.
  }
  console.log(JSON.stringify({ valid: false, stage: 'manifest', details }, null, 2));
  process.exit(1);
}

const errors = [];

function addError(field, code, message) {
  errors.push({ field, code, message });
}

function verifyFile(baseDirectory, relativePath, expectedHash, field) {
  let filePath;
  try {
    filePath = safePath(baseDirectory, relativePath);
  } catch (error) {
    addError(field, 'unsafe-path', error.message);
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    addError(field, 'missing-file', `Falta el artefacto ${relativePath}.`);
    return;
  }
  if (typeof expectedHash !== 'string' || sha256(filePath) !== expectedHash) {
    addError(field, 'hash-mismatch', `El hash no corresponde al artefacto ${relativePath}.`);
  }
}

try {
  const { manifest, manifestPath, baseDirectory } = loadManifest(manifestArgument);
  if (manifest.target.commit === null) {
    addError('target.commit', 'pending-target-commit', 'Debe fijar el commit objetivo antes del gate final.');
  }
  for (const [index, asset] of manifest.assets.entries()) {
    if (asset.status === 'missing') {
      addError(`assets[${index}].status`, 'missing-asset', `El asset ${asset.id} continúa ausente.`);
    }
    if (
      asset.status === 'approved-substitute' &&
      (!asset.approval?.authority || !asset.approval?.reference)
    ) {
      addError(
        `assets[${index}].approval`,
        'missing-substitute-approval',
        `El sustituto ${asset.id} no enlaza una aprobación humana.`,
      );
    }
  }

  for (const [index, row] of manifest.evidence.entries()) {
    const key = evidenceKey(row);
    if (row.status === 'pending' || row.status === 'different') {
      addError(`evidence[${index}].status`, 'unresolved-evidence', `${key} continúa en estado ${row.status}.`);
    }
    if (row.status === 'matched' && row.metrics?.exactDifferentPixels !== 0) {
      addError(`evidence[${index}].metrics`, 'invalid-match', `${key} no es idéntica píxel a píxel.`);
    }
    for (const [pathField, hashField] of [
      ['sourceCapture', 'sourceCaptureSha256'],
      ['targetCapture', 'targetCaptureSha256'],
      ['comparisonCapture', 'comparisonCaptureSha256'],
      ['overlayCapture', 'overlayCaptureSha256'],
      ['diffCapture', 'diffCaptureSha256'],
    ]) {
      verifyFile(baseDirectory, row[pathField], row[hashField], `evidence[${index}].${pathField}`);
    }
    for (const timestamp of ['sourceCapturedAt', 'targetCapturedAt', 'comparedAt']) {
      if (typeof row[timestamp] !== 'string' || Number.isNaN(Date.parse(row[timestamp]))) {
        addError(`evidence[${index}].${timestamp}`, 'missing-timestamp', `${key} no registra ${timestamp}.`);
      }
    }
  }

  verifyFile(baseDirectory, manifest.report.json, manifest.report.jsonSha256, 'report.json');
  verifyFile(baseDirectory, manifest.report.html, manifest.report.htmlSha256, 'report.html');
  const reportPath = safePath(baseDirectory, manifest.report.json);
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      if (report.sourceCommit !== manifest.source.commit || report.targetCommit !== manifest.target.commit) {
        addError('report', 'stale-report', 'El reporte no corresponde a los commits del manifiesto.');
      }
      const reportRows = new Map((report.evidence ?? []).map((row) => [row.key, row]));
      for (const row of manifest.evidence) {
        if (reportRows.get(evidenceKey(row))?.status !== row.status) {
          addError('report.evidence', 'stale-report-row', `El reporte no refleja ${evidenceKey(row)}.`);
        }
      }
    } catch (error) {
      addError('report.json', 'invalid-report', error.message);
    }
  }

  const result = {
    valid: errors.length === 0,
    manifestPath,
    summary: {
      errors: errors.length,
      evidence: manifest.evidence.length,
      matched: manifest.evidence.filter(({ status }) => status === 'matched').length,
      approvedDifferences: manifest.evidence.filter(({ status }) => status === 'approved-difference').length,
    },
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify({ valid: false, stage: 'gate', error: error.message }, null, 2));
  process.exit(1);
}
