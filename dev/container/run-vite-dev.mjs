#!/usr/bin/env node
/**
 * Dev stack Vite entry: run Vite with a wrapper config that merges local @shellui/* aliases.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  generateViteDevWrapperSource,
  resolveShelluiRoot,
  resolveViteLaunch,
  shelluiSourceAliases,
  viteDevWrapperConfigPath,
} from './local-vite-shellui.mjs';

const appDir = process.cwd();
const devContainerDir = path.dirname(fileURLToPath(import.meta.url));
const shelluiRoot = process.env.SHELLUI_ROOT
  ? path.resolve(process.env.SHELLUI_ROOT)
  : path.resolve(devContainerDir, '../..');

const require = createRequire(pathToFileURL(path.join(appDir, 'package.json')));

/** @param {string} name */
function tryResolve(name) {
  try {
    return require.resolve(name);
  } catch {
    return null;
  }
}

const vitePkg = tryResolve('vite/package.json');
if (!vitePkg) {
  console.error('vite is not installed in', appDir);
  process.exit(1);
}

const { command: viteCommand, argsPrefix: viteArgsPrefix } = resolveViteLaunch({
  appDir,
  vitePkgPath: vitePkg,
});

const configFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
let appConfigFile = null;
for (const name of configFiles) {
  const candidate = path.join(appDir, name);
  if (fs.existsSync(candidate)) {
    appConfigFile = candidate;
    break;
  }
}

const monorepoRoot = resolveShelluiRoot(shelluiRoot);
const localAliases = monorepoRoot ? shelluiSourceAliases(monorepoRoot) : {};
const aliasKeys = Object.keys(localAliases).sort((a, b) => b.length - a.length);

/**
 * Vite resolves some dependencies (e.g. tailwindcss for @tailwindcss/vite) from the
 * config file directory. Generate the wrapper under the app without importing /opt/shellui.
 */
const configStub = viteDevWrapperConfigPath(appDir);
fs.mkdirSync(path.dirname(configStub), { recursive: true });

fs.writeFileSync(
  configStub,
  generateViteDevWrapperSource({
    appConfigPath: appConfigFile ?? '',
    localAliases,
    aliasKeys,
    monorepoRoot,
  }),
);

const argv = process.argv.slice(2);
/** @type {string[]} */
const viteArgs = ['--config', configStub, ...argv];

const spawnEnv = {
  ...process.env,
  SHELLUI_VITE_APP_DIR: appDir,
  SHELLUI_ROOT: shelluiRoot,
};

const child = spawn(viteCommand, [...viteArgsPrefix, ...viteArgs], {
  cwd: appDir,
  env: spawnEnv,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
