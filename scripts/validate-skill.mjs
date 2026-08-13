#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(repositoryRoot, 'skills', 'transform-claude-to-gutenberg');
const skillPath = path.join(skillRoot, 'SKILL.md');
const errors = [];

function addError(file, message) {
  errors.push({ file: path.relative(repositoryRoot, file), message });
}

if (!fs.existsSync(skillPath)) {
  addError(skillPath, 'Falta SKILL.md.');
} else {
  const skill = fs.readFileSync(skillPath, 'utf8');
  const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---\n/);

  if (!frontmatterMatch) {
    addError(skillPath, 'El frontmatter YAML no es válido.');
  } else {
    const keys = [...frontmatterMatch[1].matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((match) => match[1]);
    if (keys.join(',') !== 'name,description') {
      addError(skillPath, 'El frontmatter debe contener únicamente name y description, en ese orden.');
    }
    if (!/^name: transform-claude-to-gutenberg$/m.test(frontmatterMatch[1])) {
      addError(skillPath, 'El nombre del skill no coincide con su directorio.');
    }
  }

  for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
    const referencePath = path.join(skillRoot, match[1]);
    if (!fs.existsSync(referencePath)) {
      addError(skillPath, `La referencia ${match[1]} no existe.`);
    }
  }

  if (skill.split('\n').length > 500) {
    addError(skillPath, 'SKILL.md supera el límite de 500 líneas.');
  }
}

const openaiYamlPath = path.join(skillRoot, 'agents', 'openai.yaml');
if (!fs.existsSync(openaiYamlPath)) {
  addError(openaiYamlPath, 'Faltan los metadatos de interfaz.');
} else {
  const openaiYaml = fs.readFileSync(openaiYamlPath, 'utf8');
  if (!openaiYaml.includes('$transform-claude-to-gutenberg')) {
    addError(openaiYamlPath, 'El prompt por defecto no invoca el skill explícitamente.');
  }
}

const publicFiles = [];
function visit(current) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    if (relativePath === path.join('docs', 'standards')) {
      continue;
    }
    if (entry.isDirectory()) {
      visit(absolutePath);
    } else if (entry.isFile()) {
      publicFiles.push(absolutePath);
    }
  }
}
visit(repositoryRoot);

const forbiddenPatterns = [
  { pattern: /\/Users\/[a-zA-Z0-9._-]+\//, message: 'Contiene una ruta personal absoluta.' },
  { pattern: /\b(?:gh[opsu]_|github_pat_)[a-zA-Z0-9_]+\b/, message: 'Contiene un token de GitHub.' },
  { pattern: /\bsk-[a-zA-Z0-9_-]{20,}\b/, message: 'Contiene una clave con formato sensible.' },
  { pattern: /\u2014/, message: 'Contiene una raya tipográfica larga.' },
];

for (const file of publicFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(content)) {
      addError(file, message);
    }
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ valid: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ valid: true, filesChecked: publicFiles.length }, null, 2));
