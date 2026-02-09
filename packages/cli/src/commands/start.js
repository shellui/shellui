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
  createViteDefine,
  createViteResolveConfig,
  createViteOptimizeDepsConfig,
  getDedupeList,
  getShelluiExcludePackages,
  resolvePackagePath,
} from '../utils/index.js';
import { serviceWorkerDevPlugin } from '../utils/service-worker-plugin.js';

let currentServer = null;
let configWatcher = null;
let restartTimeout = null;
let isFirstStart = true;

/**
 * Plugin to prevent Vite from creating cache files inside @shellui/core
 * This ensures all cache is created only in the project root's node_modules/.vite
 */
function preventNestedCachePlugin(viteCacheDir) {
  return {
    name: 'prevent-nested-cache',
    configResolved(config) {
      if (config.cacheDir && !path.isAbsolute(config.cacheDir)) {
        throw new Error(
          `cacheDir must be absolute path, got: ${config.cacheDir}. This prevents cache creation inside @shellui/core`,
        );
      }
    },
    buildStart() {
      // Check if any .vite directories exist inside @shellui/core and warn/remove them
      const corePackagePath = resolvePackagePath('@shellui/core');
      const nestedViteCache = path.join(corePackagePath, 'node_modules', '.vite');
      if (fs.existsSync(nestedViteCache)) {
        console.warn(
          pc.yellow(
            `⚠️  Found nested .vite cache at ${nestedViteCache}. This should not exist. Removing...`,
          ),
        );
        try {
          fs.rmSync(nestedViteCache, { recursive: true, force: true });
          console.log(pc.green(`✅ Removed nested cache directory`));
        } catch (e) {
          console.error(pc.red(`❌ Failed to remove nested cache: ${e.message}`));
        }
      }

      // Also remove any optimized @shellui/core files from .vite/deps
      const viteDepsDir = path.join(viteCacheDir, 'deps');
      if (fs.existsSync(viteDepsDir)) {
        try {
          const files = fs.readdirSync(viteDepsDir);
          const shelluiFiles = files.filter(
            (f) => f.startsWith('@shellui') || f.startsWith('@_features'),
          );
          if (shelluiFiles.length > 0) {
            console.warn(
              pc.yellow(
                `⚠️  Found optimized @shellui/core files in .vite/deps. Removing ${shelluiFiles.length} files...`,
              ),
            );
            shelluiFiles.forEach((file) => {
              const filePath = path.join(viteDepsDir, file);
              try {
                fs.unlinkSync(filePath);
                const mapPath = filePath + '.map';
                if (fs.existsSync(mapPath)) {
                  fs.unlinkSync(mapPath);
                }
              } catch (e) {
                // Ignore errors
              }
            });
            console.log(pc.green(`✅ Removed optimized @shellui/core files`));
          }
        } catch (e) {
          // Ignore errors reading directory
        }
      }
    },
  };
}

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

  const resolveConfig = createViteResolveConfig();
  const resolveAlias = createResolveAlias();

  const server = await createServer({
    root: coreSrcPath,
    // Force cacheDir to project root - this prevents Vite from creating cache
    // relative to root (which would be inside @shellui/core)
    cacheDir: viteCacheDir,
    plugins: [
      react(),
      serviceWorkerDevPlugin(corePackagePath, coreSrcPath),
      preventNestedCachePlugin(viteCacheDir),
      {
        name: 'prevent-shellui-optimization',
        enforce: 'pre',
        config(config) {
          if (!config.optimizeDeps) {
            config.optimizeDeps = {};
          }
          const originalExclude = config.optimizeDeps.exclude || [];
          const excludeArray = Array.isArray(originalExclude)
            ? [...originalExclude]
            : [originalExclude].filter(Boolean);

          // Dynamically get all @shellui/* packages that should be excluded
          const shelluiExcludePackages = getShelluiExcludePackages();
          shelluiExcludePackages.forEach((pkg) => {
            if (!excludeArray.includes(pkg)) {
              excludeArray.push(pkg);
            }
          });

          config.optimizeDeps.exclude = excludeArray;
        },
        resolveId(id, importer) {
          if (id && typeof id === 'string') {
            if (id.includes('@_features') || id.includes('@shellui/core/src/')) {
              return null;
            }
          }
          return null;
        },
        load(id) {
          if (id && typeof id === 'string' && id.includes('@_features')) {
            return null;
          }
          return null;
        },
        transform(code, id) {
          if (
            id &&
            typeof id === 'string' &&
            (id.includes('@shellui/core/src/') || id.includes('@_features'))
          ) {
            return null;
          }
          return null;
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (
              req.url &&
              (req.url.includes('@_features') || req.url.includes('/.vite/deps/@shellui'))
            ) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(
                'Optimized @shellui/core files are disabled. Loading from source instead.',
              );
              return;
            }
            next();
          });
        },
      },
    ],
    define: createViteDefine(config),
    resolve: {
      ...resolveConfig,
      // Dynamically dedupe React, ReactDOM, @shellui packages, and all @shellui/core dependencies
      // This ensures all modules resolve from project root to prevent duplicate instances
      dedupe: getDedupeList(),
      preserveSymlinks: false,
      alias: {
        ...resolveAlias,
        // Force @shellui/core to always resolve from project root to prevent duplicates
        '@shellui/core': corePackagePath,
      },
      conditions: ['import', 'module', 'browser', 'default'],
      mainFields: ['browser', 'module', 'jsnext:main', 'jsnext', 'main'],
    },
    optimizeDeps: {
      // Dynamically exclude @shellui packages and include all @shellui/core dependencies
      // This ensures dependencies are optimized from project root, preventing nested resolution
      ...createViteOptimizeDepsConfig(),
      force: false,
      esbuildOptions: {
        absWorkingDir: path.resolve(cwd, root),
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
  const jsonConfigPath = path.join(configDir, 'shellui.config.json');

  // Determine which config file exists (prefer TypeScript)
  let configPath = null;
  if (fs.existsSync(tsConfigPath)) {
    configPath = tsConfigPath;
  } else if (fs.existsSync(jsonConfigPath)) {
    configPath = jsonConfigPath;
  }

  // Only watch if config file exists
  if (!configPath) {
    console.log(
      pc.yellow(`No shellui.config.ts or shellui.config.json found, config watching disabled.`),
    );
    return;
  }

  // Close existing watcher if any
  if (configWatcher) {
    configWatcher.close();
  }

  configWatcher = fs.watch(configPath, { persistent: true }, async (eventType) => {
    if (eventType === 'change') {
      await restartServer(root, cwd);
    }
  });

  console.log(pc.green(`👀 Watching config file: ${configPath}`));
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
