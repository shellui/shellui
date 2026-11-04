import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createShelluiDevStackPlugins,
  generateViteDevWrapperSource,
  mergeShelluiLocalViteConfig,
  resolveViteLaunch,
  viteDevWrapperConfigPath,
} from './local-vite-shellui.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliRequire = createRequire(path.join(repoRoot, 'packages/cli/package.json'));

/** @returns {string} */
function vitePackageDir() {
  return path.dirname(cliRequire.resolve('vite/package.json'));
}

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

test('generated vite wrapper loads the app config via loadConfigFromFile and appends dev plugins', () => {
  const appConfigPath = '/app/vite.config.js';
  const source = generateViteDevWrapperSource({
    appConfigPath,
    localAliases: { '@shellui/sdk': '/opt/shellui/packages/sdk/src/index.ts' },
    aliasKeys: ['@shellui/sdk'],
    monorepoRoot: '/opt/shellui',
  });
  assert.match(source, /import \{ loadConfigFromFile \} from 'vite'/);
  assert.match(source, /loadConfigFromFile\(env,/);
  assert.doesNotMatch(source, /await import\(/);
  assert.match(source, /configFile: false/);
  assert.match(source, /\[\.\.\.\(userConfig\.plugins \?\? \[\]\), \.\.\.shelluiPlugins\]/);
  assert.ok(source.includes(JSON.stringify(appConfigPath)));
});

test('generated vite wrapper loads vite.config.ts that uses __dirname', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-vite-wrapper-'));
  const appConfigPath = path.join(tmp, 'vite.config.ts');
  fs.writeFileSync(
    appConfigPath,
    `import path from 'node:path';
export default {
  root: path.join(__dirname, 'src'),
};
`,
  );

  const viteLink = path.join(tmp, 'node_modules', 'vite');
  fs.mkdirSync(path.dirname(viteLink), { recursive: true });
  fs.symlinkSync(vitePackageDir(), viteLink, 'dir');

  const wrapperPath = path.join(tmp, 'node_modules', '.shellui', 'vite-dev.config.mjs');
  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
  fs.writeFileSync(
    wrapperPath,
    generateViteDevWrapperSource({
      appConfigPath,
      localAliases: {},
      aliasKeys: [],
      monorepoRoot: null,
    }),
  );

  process.env.SHELLUI_VITE_APP_DIR = tmp;
  const mod = await import(pathToFileURL(wrapperPath).href);
  const config = await mod.default({ command: 'serve', mode: 'development' });
  assert.equal(config.root, path.join(tmp, 'src'));
  assert.equal(config.configFile, false);
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
