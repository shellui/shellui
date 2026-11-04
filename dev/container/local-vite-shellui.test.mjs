import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createShelluiDevStackPlugins,
  mergeShelluiLocalViteConfig,
} from './local-vite-shellui.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('mergeShelluiLocalViteConfig adds dev stack plugins when shellui root is valid', () => {
  const merged = mergeShelluiLocalViteConfig({}, repoRoot);
  assert.equal(merged.plugins?.length, 1);
  assert.equal(merged.plugins?.[0]?.name, 'shellui-dev-local-packages');
});

test('mergeShelluiLocalViteConfig adds no plugins without a valid shellui root', () => {
  assert.deepEqual(mergeShelluiLocalViteConfig({}, '/nonexistent'), { plugins: [] });
});

test('shellui dev plugin extends fs.allow for the monorepo mount', () => {
  const [plugin] = createShelluiDevStackPlugins(repoRoot);
  const resolved = {
    resolve: { dedupe: [] },
    optimizeDeps: { exclude: [] },
    server: { fs: { allow: ['/app'] } },
  };
  plugin.configResolved(resolved);
  assert.ok(resolved.server.fs.allow.includes('/app'));
  assert.ok(resolved.server.fs.allow.includes(repoRoot));
  assert.ok(resolved.server.fs.allow.includes(path.join(repoRoot, 'packages')));
});
