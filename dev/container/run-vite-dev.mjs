#!/usr/bin/env node
/**
 * Dev stack Vite entry: run Vite with a wrapper config that merges local @shellui/* aliases.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveShelluiRoot, shelluiSourceAliases } from './local-vite-shellui.mjs';

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

const viteBin = path.join(path.dirname(vitePkg), 'bin', 'vite.js');
const viteBinShim = path.join(appDir, 'node_modules', '.bin', 'vite');

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
const configStubDir = path.join(appDir, 'node_modules', '.shellui');
const configStub = path.join(configStubDir, 'vite-dev.config.mjs');
fs.mkdirSync(configStubDir, { recursive: true });

const appConfigHref = appConfigFile ? pathToFileURL(appConfigFile).href : '';

fs.writeFileSync(
  configStub,
  `export default async (env) => {
  ${
    appConfigHref
      ? `const mod = await import(${JSON.stringify(appConfigHref)});
  const exported = mod.default ?? mod;
  const userConfig = typeof exported === 'function' ? await exported(env) : exported;`
      : 'const userConfig = {};'
  }
  const localAliases = ${JSON.stringify(localAliases)};
  const aliasKeys = ${JSON.stringify(aliasKeys)};
  const shelluiMonorepoRoot = ${JSON.stringify(monorepoRoot)};
  const shelluiPlugins =
    aliasKeys.length > 0
      ? [
          {
            name: 'shellui-dev-local-packages',
            enforce: 'pre',
            resolveId(source) {
              for (const key of aliasKeys) {
                if (source === key) {
                  return localAliases[key];
                }
              }
              return null;
            },
            configResolved(resolved) {
              if (!shelluiMonorepoRoot) return;
              const dedupe = new Set(resolved.resolve.dedupe ?? []);
              for (const pkg of ['react', 'react-dom', '@shellui/sdk', '@shellui/core']) {
                dedupe.add(pkg);
              }
              resolved.resolve.dedupe = [...dedupe];
              const exclude = new Set(resolved.optimizeDeps.exclude ?? []);
              exclude.add('@shellui/sdk');
              exclude.add('@shellui/core');
              resolved.optimizeDeps.exclude = [...exclude];
              const allow = new Set(resolved.server.fs.allow);
              allow.add(shelluiMonorepoRoot);
              allow.add(shelluiMonorepoRoot + '/packages');
              allow.add(shelluiMonorepoRoot + '/node_modules');
              resolved.server.fs.allow = [...allow];
            },
          },
        ]
      : [];
  return { ...userConfig, plugins: [...(userConfig.plugins ?? []), ...shelluiPlugins] };
};
`,
);

const argv = process.argv.slice(2);
/** @type {string[]} */
const viteArgs = ['--config', configStub, ...argv];

const spawnEnv = {
  ...process.env,
  SHELLUI_VITE_APP_DIR: appDir,
  SHELLUI_ROOT: shelluiRoot,
};

/** @type {import('node:child_process').ChildProcess} */
let child;
if (fs.existsSync(viteBinShim)) {
  child = spawn(viteBinShim, viteArgs, {
    cwd: appDir,
    env: spawnEnv,
    stdio: 'inherit',
  });
} else {
  child = spawn(process.execPath, [viteBin, ...viteArgs], {
    cwd: appDir,
    env: spawnEnv,
    stdio: 'inherit',
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
