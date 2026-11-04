import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { mergeShelluiLocalViteConfig } from './local-vite-shellui.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appDir = '/app';

test('mergeShelluiLocalViteConfig keeps the frontend app root on server.fs.allow', () => {
  const merged = mergeShelluiLocalViteConfig({}, repoRoot, {
    appDir,
    workspaceRoot: appDir,
  });

  const allow = merged.server?.fs?.allow ?? [];
  assert.ok(allow.includes(appDir), `expected ${appDir} in fs.allow, got ${allow.join(', ')}`);
  assert.ok(
    allow.includes(repoRoot),
    `expected monorepo root in fs.allow, got ${allow.join(', ')}`,
  );
  assert.ok(
    allow.includes(path.join(repoRoot, 'packages')),
    `expected monorepo packages in fs.allow`,
  );
});

test('mergeShelluiLocalViteConfig is unchanged without a valid shellui root', () => {
  const config = { server: { fs: { allow: ['/only'] } } };
  assert.deepEqual(mergeShelluiLocalViteConfig(config, '/nonexistent'), config);
});
