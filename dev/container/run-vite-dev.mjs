#!/usr/bin/env node
/**
 * Dev stack Vite entry: load the app vite.config and merge local @shellui/* aliases.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mergeShelluiLocalViteConfig } from './local-vite-shellui.mjs';

const appDir = process.cwd();
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

const viteEntry = path.join(path.dirname(vitePkg), 'dist', 'node', 'index.js');
const vite = await import(pathToFileURL(viteEntry).href);

/** @type {{ host?: string, port?: number }} */
const cliServer = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--host' && argv[i + 1]) {
    cliServer.host = argv[i + 1];
    i += 1;
  } else if (arg === '--port' && argv[i + 1]) {
    cliServer.port = Number(argv[i + 1]);
    i += 1;
  }
}

const configFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
let configFile = null;
for (const name of configFiles) {
  const candidate = path.join(appDir, name);
  if (fs.existsSync(candidate)) {
    configFile = candidate;
    break;
  }
}

const loaded = configFile
  ? await vite.loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile, appDir)
  : { config: {}, path: configFile, dependencies: [] };

const withLocal = mergeShelluiLocalViteConfig(loaded.config, process.env.SHELLUI_ROOT);
const merged = vite.mergeConfig(withLocal, {
  server: {
    host: cliServer.host ?? true,
    ...(cliServer.port ? { port: cliServer.port } : {}),
  },
});

const server = await vite.createServer(merged);
await server.listen();
server.printUrls();
