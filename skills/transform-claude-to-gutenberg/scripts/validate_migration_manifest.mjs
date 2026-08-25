#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const manifestArgument = process.argv[2];

if (!manifestArgument) {
  console.error('Uso: node validate_migration_manifest.mjs <ruta-manifiesto>');
  process.exit(2);
}

const manifestPath = path.resolve(manifestArgument);

if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
  console.error(`El manifiesto no existe o no es un archivo: ${manifestPath}`);
  process.exit(2);
}

const errors = [];
const warnings = [];

function addError(field, code, message) {
  errors.push({ field, code, message });
}

function addWarning(field, code, message) {
  warnings.push({ field, code, message });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(object, field, prefix) {
  const value = object?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    addError(`${prefix}.${field}`, 'required-string', 'Debe ser un string no vacío.');
    return '';
  }
  return value;
}

function validateId(value, field) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    addError(field, 'invalid-id', 'Debe usar minúsculas, números y guiones.');
    return false;
  }
  return true;
}

function validateUniqueIds(items, field) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const idField = `${field}[${index}].id`;
    if (!isObject(item) || !validateId(item.id, idField)) {
      continue;
    }
    if (ids.has(item.id)) {
      addError(idField, 'duplicate-id', `El ID ${item.id} está duplicado.`);
    }
    ids.add(item.id);
  }
  return ids;
}

function validateCommit(value, field, optional = false) {
  if (optional && value === null) {
    return;
  }
  if (typeof value !== 'string' || !/^[0-9a-f]{7,64}$/i.test(value)) {
    addError(field, 'invalid-commit', 'Debe ser un hash Git inmutable de 7 a 64 caracteres hexadecimales.');
  }
}

function containsPrivatePath(value) {
  return (
    typeof value === 'string' &&
    (/\/Users\/[a-zA-Z0-9._-]+\//.test(value) || /[A-Za-z]:\\Users\\[^\\]+\\/.test(value))
  );
}

function validateRepository(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(field, 'required-string', 'Debe identificar un repositorio estable.');
  } else if (containsPrivatePath(value)) {
    addError(field, 'private-path', 'No se permiten rutas personales absolutas.');
  }
}

function validateEvidencePath(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(field, 'required-path', 'Debe declarar una ruta relativa de evidencia.');
    return;
  }
  if (
    path.isAbsolute(value) ||
    value.split(/[\\/]+/).includes('..') ||
    /^[a-z]+:\/\//i.test(value) ||
    containsPrivatePath(value)
  ) {
    addError(field, 'unsafe-evidence-path', 'La evidencia debe usar una ruta relativa estable sin escapar del manifiesto.');
  }
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  const report = {
    valid: false,
    manifestPath,
    summary: { errors: 1, warnings: 0 },
    errors: [{ field: '$', code: 'invalid-json', message: error.message }],
    warnings: [],
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

if (!isObject(manifest)) {
  addError('$', 'invalid-root', 'El manifiesto debe ser un objeto JSON.');
  manifest = {};
}

if (manifest.schemaVersion !== 1) {
  addError('schemaVersion', 'unsupported-schema-version', 'La única versión admitida es 1.');
}

if (!['ninguno', 'cambio-visual', 'paridad-1-1'].includes(manifest.impact)) {
  addError('impact', 'invalid-impact', 'Debe ser ninguno, cambio-visual o paridad-1-1.');
}

if (!isObject(manifest.project)) {
  addError('project', 'required-object', 'Debe ser un objeto.');
} else {
  validateId(manifest.project.id, 'project.id');
  requireString(manifest.project, 'title', 'project');
}

if (!isObject(manifest.source)) {
  addError('source', 'required-object', 'Debe ser un objeto.');
} else {
  validateRepository(manifest.source.repository, 'source.repository');
  validateCommit(manifest.source.commit, 'source.commit');
  requireString(manifest.source, 'installCommand', 'source');
  requireString(manifest.source, 'runCommand', 'source');
}

if (!isObject(manifest.target)) {
  addError('target', 'required-object', 'Debe ser un objeto.');
} else {
  validateRepository(manifest.target.repository, 'target.repository');
  validateCommit(manifest.target.commit, 'target.commit', true);
  requireString(manifest.target, 'wordpressVersion', 'target');
  requireString(manifest.target, 'phpVersion', 'target');
  if (manifest.target.commit === null) {
    addWarning('target.commit', 'pending-target-commit', 'Debe fijarse antes del gate final.');
  }
}

if (!isObject(manifest.environment)) {
  addError('environment', 'required-object', 'Debe ser un objeto.');
} else {
  for (const field of ['browser', 'browserVersion', 'locale', 'timezone', 'colorScheme', 'reducedMotion']) {
    requireString(manifest.environment, field, 'environment');
  }
  if (!Array.isArray(manifest.environment.fonts) || manifest.environment.fonts.length === 0) {
    addError('environment.fonts', 'required-array', 'Debe enumerar al menos una fuente cargada.');
  } else if (manifest.environment.fonts.some((font) => typeof font !== 'string' || font.trim() === '')) {
    addError('environment.fonts', 'invalid-font', 'Cada fuente debe ser un string no vacío.');
  }
}

const viewports = Array.isArray(manifest.viewports) ? manifest.viewports : [];
if (viewports.length === 0) {
  addError('viewports', 'required-array', 'Debe declarar al menos un viewport.');
}
const viewportIds = validateUniqueIds(viewports, 'viewports');
for (const [index, viewport] of viewports.entries()) {
  for (const field of ['width', 'height', 'deviceScaleFactor']) {
    if (typeof viewport?.[field] !== 'number' || !Number.isFinite(viewport[field]) || viewport[field] <= 0) {
      addError(`viewports[${index}].${field}`, 'invalid-positive-number', 'Debe ser un número positivo.');
    }
  }
}

const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];
if (surfaces.length === 0) {
  addError('surfaces', 'required-array', 'Debe declarar al menos una superficie.');
}
validateUniqueIds(surfaces, 'surfaces');

const expectedEvidence = new Set();
for (const [index, surface] of surfaces.entries()) {
  if (!isObject(surface)) {
    addError(`surfaces[${index}]`, 'required-object', 'Debe ser un objeto.');
    continue;
  }
  requireString(surface, 'owner', `surfaces[${index}]`);
  requireString(surface, 'sourceUrl', `surfaces[${index}]`);
  requireString(surface, 'targetUrl', `surfaces[${index}]`);
  requireString(surface, 'fixture', `surfaces[${index}]`);

  const states = Array.isArray(surface.states) ? surface.states : [];
  const surfaceViewports = Array.isArray(surface.viewports) ? surface.viewports : [];
  if (states.length === 0) {
    addError(`surfaces[${index}].states`, 'required-array', 'Debe declarar al menos un estado.');
  }
  if (new Set(states).size !== states.length || states.some((state) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state))) {
    addError(`surfaces[${index}].states`, 'invalid-states', 'Los estados deben ser IDs únicos.');
  }
  if (surfaceViewports.length === 0) {
    addError(`surfaces[${index}].viewports`, 'required-array', 'Debe declarar al menos un viewport.');
  }
  for (const viewport of surfaceViewports) {
    if (!viewportIds.has(viewport)) {
      addError(`surfaces[${index}].viewports`, 'unknown-viewport', `El viewport ${String(viewport)} no existe.`);
    }
  }
  if (new Set(surfaceViewports).size !== surfaceViewports.length) {
    addError(`surfaces[${index}].viewports`, 'duplicate-viewport-reference', 'No debe repetir viewports.');
  }
  for (const state of states) {
    for (const viewport of surfaceViewports) {
      expectedEvidence.add(`${surface.id}|${state}|${viewport}`);
    }
  }
}

const ownership = Array.isArray(manifest.ownership) ? manifest.ownership : [];
if (ownership.length === 0) {
  addError('ownership', 'required-array', 'Debe declarar al menos una responsabilidad.');
}
validateUniqueIds(ownership, 'ownership');
for (const [index, item] of ownership.entries()) {
  if (!['token', 'component', 'composition', 'behavior', 'integration', 'asset'].includes(item?.kind)) {
    addError(`ownership[${index}].kind`, 'invalid-ownership-kind', 'El tipo de propiedad no está admitido.');
  }
  requireString(item, 'owner', `ownership[${index}]`);
}

const assets = Array.isArray(manifest.assets) ? manifest.assets : null;
if (assets === null) {
  addError('assets', 'required-array', 'Debe declarar el inventario de assets, aunque esté vacío.');
} else {
  validateUniqueIds(assets, 'assets');
  for (const [index, asset] of assets.entries()) {
    if (!['available', 'missing', 'approved-substitute'].includes(asset?.status)) {
      addError(`assets[${index}].status`, 'invalid-asset-status', 'El estado del asset no está admitido.');
    }
    requireString(asset, 'owner', `assets[${index}]`);
    requireString(asset, 'source', `assets[${index}]`);
    requireString(asset, 'license', `assets[${index}]`);
  }
}

const evidence = Array.isArray(manifest.evidence) ? manifest.evidence : [];
if (evidence.length === 0 && expectedEvidence.size > 0) {
  addError('evidence', 'required-array', 'Debe indexar cada combinación esperada.');
}
const actualEvidence = new Set();
for (const [index, item] of evidence.entries()) {
  if (!isObject(item)) {
    addError(`evidence[${index}]`, 'required-object', 'Debe ser un objeto.');
    continue;
  }
  const key = `${item.surface}|${item.state}|${item.viewport}`;
  if (actualEvidence.has(key)) {
    addError(`evidence[${index}]`, 'duplicate-evidence', `La combinación ${key} está duplicada.`);
  }
  actualEvidence.add(key);
  if (!expectedEvidence.has(key)) {
    addError(`evidence[${index}]`, 'unexpected-evidence', `La combinación ${key} no fue declarada por una superficie.`);
  }
  for (const field of ['sourceCapture', 'targetCapture', 'comparisonCapture']) {
    validateEvidencePath(item[field], `evidence[${index}].${field}`);
  }
  if (!['pending', 'matched', 'different', 'approved-difference'].includes(item.status)) {
    addError(`evidence[${index}].status`, 'invalid-evidence-status', 'El estado de evidencia no está admitido.');
  }
  if (item.status === 'approved-difference') {
    if (typeof item.difference !== 'string' || item.difference.trim() === '') {
      addError(`evidence[${index}].difference`, 'required-difference', 'Debe explicar la diferencia aprobada.');
    }
    if (!isObject(item.approval)) {
      addError(`evidence[${index}].approval`, 'required-approval', 'Debe enlazar la aprobación humana.');
    } else {
      requireString(item.approval, 'authority', `evidence[${index}].approval`);
      requireString(item.approval, 'reference', `evidence[${index}].approval`);
    }
  }
}

for (const key of expectedEvidence) {
  if (!actualEvidence.has(key)) {
    addError('evidence', 'missing-evidence', `Falta la combinación ${key}.`);
  }
}

const report = {
  valid: errors.length === 0,
  manifestPath,
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    viewports: viewports.length,
    surfaces: surfaces.length,
    expectedEvidence: expectedEvidence.size,
    indexedEvidence: evidence.length,
  },
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
