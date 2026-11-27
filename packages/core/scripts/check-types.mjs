#!/usr/bin/env node
// Typecheck @shellui/core and fail on any error that is not in the baseline.
//
// Core was never typechecked in CI, so it carries a backlog of errors. The baseline
// (typecheck-baseline.json) records them per file and error code. A new error, or one more
// of an existing kind in a file, fails the check. Fixing errors never fails it: run
// `node scripts/check-types.mjs --update` to shrink the baseline.
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
for (const line of output.split('\n')) {
  const match = /^(.+?)\(\d+,\d+\): error (TS\d+):/.exec(line);
  if (!match) continue;
  const key = `${match[1].replaceAll('\\', '/')} ${match[2]}`;
  found[key] = (found[key] ?? 0) + 1;
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
  for (const line of output.split('\n')) {
    const match = /^(.+?)\(\d+,\d+\): error (TS\d+):/.exec(line);
    if (match && added.some(([key]) => key === `${match[1].replaceAll('\\', '/')} ${match[2]}`)) {
      console.error(line);
    }
  }
  process.exit(1);
}
const total = Object.values(found).reduce((sum, count) => sum + count, 0);
const known = Object.values(baseline).reduce((sum, count) => sum + count, 0);
console.log(`@shellui/core typecheck: no new errors (${total} known, baseline ${known}).`);
if (total < known) console.log('Errors were fixed. Run `node scripts/check-types.mjs --update`.');
