#!/usr/bin/env node
// Typecheck @shellui/core and fail on any error that is not in the baseline.
//
// Core was never typechecked in CI, so it carries a backlog of errors. The baseline
// (typecheck-baseline.json) records them per file, error code, and message. A new error
// fails the check. If the total drops below the baseline, the check also fails so the
// baseline is lowered with `node scripts/check-types.mjs --update`.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const baselinePath = new URL('../typecheck-baseline.json', import.meta.url);
const update = process.argv.includes('--update');

const run = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', '.', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const output = `${run.stdout}${run.stderr}`;
const found = {};
const parsed = [];
for (const line of output.split('\n')) {
  const match = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line);
  if (!match) continue;
  const file = match[1].replaceAll('\\', '/');
  const key = `${file} ${match[2]} ${match[3]}`;
  found[key] = (found[key] ?? 0) + 1;
  parsed.push({ key, line });
}
if (run.status !== 0 && Object.keys(found).length === 0) {
  console.error(output);
  console.error('tsc failed without reporting errors.');
  process.exit(1);
}

const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
if (update) {
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} entries to typecheck-baseline.json`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const added = Object.entries(found).filter(([key, count]) => count > (baseline[key] ?? 0));
if (added.length > 0) {
  console.error('New TypeScript errors in @shellui/core (not in typecheck-baseline.json):\n');
  for (const { key, line } of parsed) {
    if (added.some(([addedKey]) => addedKey === key)) console.error(line);
  }
  process.exit(1);
}
const total = Object.values(found).reduce((sum, count) => sum + count, 0);
const known = Object.values(baseline).reduce((sum, count) => sum + count, 0);
if (total < known) {
  console.error(
    `TypeScript errors dropped from ${known} to ${total}. Run \`node scripts/check-types.mjs --update\` to lower the baseline.`,
  );
  process.exit(1);
}
console.log(`@shellui/core typecheck: no new errors (${total} known, baseline ${known}).`);
