import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createShelluiDevStackPlugins,
  generateViteDevWrapperSource,
  mergeShelluiLocalViteConfig,
  resolveViteLaunch,
  viteDevWrapperConfigPath,
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

test('vite dev wrapper config lives under the app node_modules tree', () => {
  assert.equal(
    viteDevWrapperConfigPath('/app'),
    path.join('/app', 'node_modules', '.shellui', 'vite-dev.config.mjs'),
  );
});

test('generated vite wrapper loads the app config once and appends dev plugins', () => {
  const href = 'file:///app/vite.config.js';
  const source = generateViteDevWrapperSource({
    appConfigHref: href,
    localAliases: { '@shellui/sdk': '/opt/shellui/packages/sdk/src/index.ts' },
    aliasKeys: ['@shellui/sdk'],
    monorepoRoot: '/opt/shellui',
  });
  assert.equal((source.match(/await import/g) ?? []).length, 1);
  assert.doesNotMatch(source, /loadConfigFromFile|createServer/);
  assert.match(source, /\[\.\.\.\(userConfig\.plugins \?\? \[\]\), \.\.\.shelluiPlugins\]/);
  assert.ok(source.includes(JSON.stringify(href)));
});

test('resolveViteLaunch prefers node_modules/.bin/vite when present', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-vite-launch-'));
  const binDir = path.join(tmp, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const shim = path.join(binDir, 'vite');
  fs.writeFileSync(shim, '#!/usr/bin/env node\n');
  fs.chmodSync(shim, 0o755);

  const launch = resolveViteLaunch({
    appDir: tmp,
    vitePkgPath: path.join(tmp, 'node_modules', 'vite', 'package.json'),
  });
  assert.equal(launch.command, shim);
  assert.deepEqual(launch.argsPrefix, []);
});
