import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import {
  loadConfig,
  getWatchableConfigPaths,
  hasAnyConfig,
  getCoreSrcPath,
  createResolveAlias,
  createPostCSSConfig,
  createShelluiConfigPlugin,
  getShelluiConfigAlias,
  resolvePackagePath,
  getShelluiTargetDefine,
} from '../utils/index.js';
import { serviceWorkerDevPlugin } from '../utils/service-worker-plugin.js';
import { sentryTunnelPlugin } from '../utils/sentry-tunnel-plugin.js';
import { initCommand } from './init.js';
import { tauriDevCommand } from '../utils/tauri.js';

let currentServer = null;
/** @type {fs.FSWatcher[]} */
let configWatchers = [];
let restartTimeout = null;
let isFirstStart = true;
/** @type {string | undefined} */
let activeConfigPath;

/**
 * Apply CLI target option to process.env for Vite define injection.
 * @param {{ target?: string }} options
 */
function applyTargetOption(options = {}) {
  if (options.target === 'tauri' || options.target === 'web') {
    process.env.SHELLUI_TARGET = options.target;
  }
}

/**
 * Start the Vite server with current configuration
 * @param {string} root - Root directory
 * @param {string} cwd - Current working directory
 * @param {boolean} shouldOpen - Whether to open the browser (only on first start)
 * @param {boolean} host - Whether to listen on 0.0.0.0 (network access)
 * @returns {Promise<import('vite').ViteDevServer>}
 */
async function startServer(root, cwd, shouldOpen = false, host = false) {
  const config = await loadConfig(root, { config: activeConfigPath });

  const corePackagePath = resolvePackagePath('@shellui/core');
  const coreSrcPath = getCoreSrcPath();

  const viteCacheDir = path.resolve(cwd, root, 'node_modules', '.vite');

  const staticPath = path.resolve(cwd, root, 'static');
  const publicDir = fs.existsSync(staticPath) ? staticPath : false;

  const resolveAlias = createResolveAlias();

  const server = await createServer({
    root: coreSrcPath,
    cacheDir: viteCacheDir,
    define: getShelluiTargetDefine(config),
    plugins: [
      react(),
      createShelluiConfigPlugin(config),
      serviceWorkerDevPlugin(corePackagePath, coreSrcPath),
      sentryTunnelPlugin(),
    ],
    resolve: {
      alias: {
        ...resolveAlias,
        ...getShelluiConfigAlias(),
        '@shellui/core': corePackagePath,
      },
    },
    css: {
      postcss: createPostCSSConfig(),
    },
    publicDir: publicDir || false,
    esbuild: {
      sourcemap: false,
    },
    server: {
      port: config.port || 3000,
      strictPort: true,
      open: shouldOpen,
      host: host ? true : undefined,
      fs: {
        allow: [corePackagePath, cwd],
      },
    },
  });

  await server.listen();
  return server;
}

/**
 * Restart the server when config changes
 * @param {string} root
 * @param {string} cwd
 * @param {boolean} host
 */
async function restartServer(root, cwd, host = false) {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    try {
      console.log(pc.yellow('\n🔄 Config file changed, restarting server...\n'));

      if (currentServer) {
        await currentServer.close();
      }

      currentServer = await startServer(root, cwd, false, host);
      currentServer.printUrls();
    } catch (e) {
      console.error(pc.red(`Error restarting server: ${e.message}`));
    }
  }, 300);
}

function closeConfigWatchers() {
  for (const watcher of configWatchers) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  configWatchers = [];
}

/**
 * @param {string} root
 * @param {string} cwd
 * @param {boolean} host
 */
function watchConfig(root, cwd, host = false) {
  closeConfigWatchers();

  const paths = getWatchableConfigPaths(root, { config: activeConfigPath });
  if (!paths.length) {
    console.log(pc.yellow('No config files found, config watching disabled.'));
    return;
  }

  for (const configPath of paths) {
    const watcher = fs.watch(configPath, { persistent: true }, async (eventType) => {
      if (eventType === 'change') {
        await restartServer(root, cwd, host);
      }
    });
    configWatchers.push(watcher);
    console.log(pc.green(`👀 Watching config file: ${configPath}`));
  }
}

/**
 * Start command - Starts the Shellui development server
 * @param {string} root
 * @param {{ host?: boolean; app?: boolean; target?: string; config?: string }} options
 */
export async function startCommand(root = '.', options = {}) {
  const cwd = process.cwd();
  applyTargetOption(options);
  activeConfigPath = options.config;
  const host = !!options?.host || process.env.SHELLUI_HOST === '1';

  if (options?.app) {
    if (host) {
      process.env.SHELLUI_HOST = '1';
    }
    await tauriDevCommand(root, { host, config: options.config });
    return;
  }

  if (!hasAnyConfig(root, { config: activeConfigPath })) {
    console.log(pc.yellow(`No shellui.config.json found. Running init...`));
    await initCommand(root, { config: activeConfigPath });
  }

  console.log(pc.blue(`Starting Shellui...`));

  try {
    currentServer = await startServer(root, cwd, isFirstStart, host);
    isFirstStart = false;
    currentServer.printUrls();

    watchConfig(root, cwd, host);

    process.on('SIGTERM', async () => {
      closeConfigWatchers();
      if (currentServer) {
        await currentServer.close();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      closeConfigWatchers();
      if (currentServer) {
        await currentServer.close();
      }
      process.exit(0);
    });
  } catch (e) {
    console.error(pc.red(`Error starting server: ${e.message}`));
    process.exit(1);
  }
}
