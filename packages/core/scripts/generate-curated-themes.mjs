#!/usr/bin/env node
/**
 * Generate packages/core/schemas/curated-themes.json from curated/*.json.
 * Run: pnpm --filter @shellui/core run generate:curated-themes
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const curatedDir = path.join(packageRoot, 'src/features/theme/curated');
const outPath = path.join(packageRoot, 'schemas', 'curated-themes.json');

const files = [
  'shellui.json',
  'claude.json',
  'light-green.json',
  'zen-inspired.json',
  'astro-vista.json',
];
const themes = files.map((fileName) => {
  const full = path.join(curatedDir, fileName);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
});

const payload = { version: 1, themes };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath} (${themes.length} themes)`);
