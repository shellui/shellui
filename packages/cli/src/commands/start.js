import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import pc from 'picocolors';
import {
  loadConfig,
  getWatchableConfigPaths,
  hasAnyConfig,
  getCoreSrcPath,
  createShelluiConfigPlugin,
  createIsolatedViteConfig,
  resolvePackagePath,
  getProjectRoot,
  resolveCompanion,
  spawnCompanion,
  waitForUrl,
  followUrl,
  killProcessTree,
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
/** @type {import('child_process').ChildProcess | null} */
let companion = null;
/** @type {(() => void) | null} */
let stopFollow = null;
let shuttingDown = false;
let signalHandlersInstalled = false;

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
  const projectRoot = getProjectRoot(root, cwd);
  const isolated = createIsolatedViteConfig({
    projectRoot,
    coreSrcPath,
    corePackagePath,
    shelluiConfig: config,
  });

  const server = await createServer({
    ...isolated,
    plugins: [
      react(),
      createShelluiConfigPlugin(config),
      serviceWorkerDevPlugin(corePackagePath, coreSrcPath, projectRoot),
      sentryTunnelPlugin(),
    ],
    esbuild: {
      ...isolated.esbuild,
      sourcemap: false,
    },
    server: {
      ...isolated.server,
      port: config.port || 3000,
      strictPort: true,
      open: shouldOpen,
      host: host ? true : undefined,
    },
  });

  await server.listen();
  return server;
}

/**
 * Restart the shell Vite server when config changes. Companion stays running.
 * @param {string} root
 * @param {string} cwd
 * @param {boolean} host
 */
async function restartServer(root, cwd, host = false) {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    if (shuttingDown) return;
    try {
      console.log(pc.yellow('\n🔄 Config file changed, restarting server...\n'));

      if (currentServer) {
        await currentServer.close();
        currentServer = null;
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
 * @param {number} [code]
 */
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  if (stopFollow) {
    stopFollow();
    stopFollow = null;
  }
  closeConfigWatchers();
  if (companion) {
    killProcessTree(companion);
    companion = null;
  }
  if (currentServer) {
    try {
      await currentServer.close();
    } catch {
      // ignore
    }
    currentServer = null;
  }
  process.exit(code);
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

function installSignalHandlers() {
  if (signalHandlersInstalled) return;
  signalHandlersInstalled = true;
  const onSignal = () => {
    void shutdown(0);
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}

/**
 * Start command - Starts the Shellui development server
 * @param {string} root
 * @param {{
 *   host?: boolean;
 *   app?: boolean;
 *   target?: string;
 *   config?: string;
 *   run?: string | false;
 *   follow?: string;
 *   noRun?: boolean;
 * }} options
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

  const config = await loadConfig(root, { config: activeConfigPath });
  const companionOpts = resolveCompanion(config, options);
  const projectRoot = getProjectRoot(root, cwd);

  installSignalHandlers();

  if (companionOpts.run) {
    console.log(
      pc.blue(`[shell] Starting companion [${companionOpts.name}]: ${companionOpts.run}`),
    );
    companion = spawnCompanion({
      command: companionOpts.run,
      cwd: projectRoot,
      name: companionOpts.name,
    });
    companion.on('exit', (code, signal) => {
      if (shuttingDown) return;
      const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
      console.error(
        pc.red(`[shell] Companion [${companionOpts.name}] exited with code ${exitCode}`),
      );
      void shutdown(exitCode);
    });
    if (companionOpts.url) {
      console.log(pc.blue(`[shell] Waiting for ${companionOpts.url}...`));
      try {
        await waitForUrl(companionOpts.url);
      } catch (e) {
        console.error(pc.red(`[shell] ${e.message}`));
        await shutdown(1);
        return;
      }
    }
  }

  console.log(pc.blue(`Starting Shellui...`));

  try {
    currentServer = await startServer(root, cwd, isFirstStart, host);
    isFirstStart = false;
    currentServer.printUrls();

    watchConfig(root, cwd, host);

    if (!companionOpts.run && companionOpts.url) {
      console.log(pc.blue(`[shell] Following companion URL ${companionOpts.url}`));
      stopFollow = followUrl(companionOpts.url, {
        onDown: () => {
          console.error(pc.red(`[shell] Companion URL ${companionOpts.url} went down`));
          void shutdown(1);
        },
      });
    }
  } catch (e) {
    console.error(pc.red(`Error starting server: ${e.message}`));
    await shutdown(1);
  }
}
