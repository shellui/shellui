import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import {
  loadConfig,
  getCoreSrcPath,
  createResolveAlias,
  createPostCSSConfig,
  createShelluiConfigPlugin,
  getShelluiConfigAlias,
  resolvePackagePath,
} from '../utils/index.js';
import { serviceWorkerDevPlugin } from '../utils/service-worker-plugin.js';
import { sentryTunnelPlugin } from '../utils/sentry-tunnel-plugin.js';

let currentServer = null;
let configWatcher = null;
let restartTimeout = null;
let isFirstStart = true;

/**
 * Start the Vite server with current configuration
 * @param {string} root - Root directory
 * @param {string} cwd - Current working directory
 * @param {boolean} shouldOpen - Whether to open the browser (only on first start)
 * @returns {Promise<import('vite').ViteDevServer>}
 */
async function startServer(root, cwd, shouldOpen = false) {
  // Load configuration
  const config = await loadConfig(root);

  // Get core package paths
  const corePackagePath = resolvePackagePath('@shellui/core');
  const coreSrcPath = getCoreSrcPath();

  // Get project root node_modules path to ensure all modules resolve from root
  const projectRootNodeModules = path.resolve(cwd, root, 'node_modules');
  // CRITICAL: Set cacheDir to absolute path in project root to prevent Vite from creating
  // cache inside @shellui/core/node_modules/.vite/deps
  const viteCacheDir = path.resolve(cwd, root, 'node_modules', '.vite');

  // Check if static folder exists in project root
  const staticPath = path.resolve(cwd, root, 'static');
  const publicDir = fs.existsSync(staticPath) ? staticPath : false;

  const resolveAlias = createResolveAlias();
  const projectRoot = path.resolve(cwd, root);

  const server = await createServer({
    root: coreSrcPath,
    // Force cacheDir to project root - this prevents Vite from creating cache
    // relative to root (which would be inside @shellui/core)
    cacheDir: viteCacheDir,
    plugins: [
      react(),
      createShelluiConfigPlugin(config, { projectRoot }),
      serviceWorkerDevPlugin(corePackagePath, coreSrcPath),
      sentryTunnelPlugin(),
    ],
    resolve: {
      alias: {
        ...resolveAlias,
        ...getShelluiConfigAlias(),
        // Force @shellui/core to always resolve from project root
        '@shellui/core': corePackagePath,
      },
    },
    css: {
      postcss: createPostCSSConfig(),
    },
    publicDir: publicDir || false,
    // Disable source maps in dev mode to avoid errors from missing source map files
    // Source maps are enabled in build mode for production debugging
    esbuild: {
      sourcemap: false,
    },
    server: {
      port: config.port || 3000,
      open: shouldOpen,
      fs: {
        // Allow serving files from core package, SDK package, and user's project
        allow: [corePackagePath, cwd],
      },
    },
  });

  await server.listen();
  return server;
}

/**
 * Restart the server when config changes
 * @param {string} root - Root directory
 * @param {string} cwd - Current working directory
 */
async function restartServer(root, cwd) {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  restartTimeout = setTimeout(async () => {
    try {
      console.log(pc.yellow('\n🔄 Config file changed, restarting server...\n'));

      // Close existing server
      if (currentServer) {
        await currentServer.close();
      }

      // Start new server with updated config (don't open browser on restart)
      currentServer = await startServer(root, cwd, false);
      currentServer.printUrls();
    } catch (e) {
      console.error(pc.red(`Error restarting server: ${e.message}`));
    }
  }, 300); // Debounce: wait 300ms before restarting
}

/**
 * Watch config file for changes
 * @param {string} root - Root directory
 * @param {string} cwd - Current working directory
 */
function watchConfig(root, cwd) {
  const configDir = path.resolve(cwd, root);
  const tsConfigPath = path.join(configDir, 'shellui.config.ts');

  if (!fs.existsSync(tsConfigPath)) {
    console.log(pc.yellow(`No shellui.config.ts found, config watching disabled.`));
    return;
  }

  // Close existing watcher if any
  if (configWatcher) {
    configWatcher.close();
  }

  configWatcher = fs.watch(tsConfigPath, { persistent: true }, async (eventType) => {
    if (eventType === 'change') {
      await restartServer(root, cwd);
    }
  });

  console.log(pc.green(`👀 Watching config file: ${tsConfigPath}`));
}

/**
 * Start command - Starts the ShellUI development server
 * @param {string} root - Root directory (default: '.')
 */
export async function startCommand(root = '.') {
  const cwd = process.cwd();

  console.log(pc.blue(`Starting ShellUI...`));

  try {
    // Start initial server (open browser only on first start)
    currentServer = await startServer(root, cwd, isFirstStart);
    isFirstStart = false;
    currentServer.printUrls();

    // Watch config file for changes
    watchConfig(root, cwd);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      if (configWatcher) {
        configWatcher.close();
      }
      if (currentServer) {
        await currentServer.close();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      if (configWatcher) {
        configWatcher.close();
      }
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
