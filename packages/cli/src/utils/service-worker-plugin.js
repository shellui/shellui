import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Vite plugin to build and serve service worker in dev mode
 */
export function serviceWorkerDevPlugin(corePackagePath, coreSrcPath, sdkPackagePath) {
  let swCode = null;
  let isBuilding = false;
  let buildError = null;

  const swPath = path.join(corePackagePath, 'src', 'service-worker', 'sw-dev.ts');

  async function buildServiceWorker() {
    if (isBuilding) {
      return;
    }

    if (!fs.existsSync(swPath)) {
      buildError = `Service worker source not found at: ${swPath}`;
      console.warn(buildError);
      return;
    }

    isBuilding = true;
    buildError = null;
    try {
      // Use Vite's build API to properly resolve imports and bundle dependencies
      // Use same root and resolve config as the main Vite server for consistent resolution
      const result = await build({
        root: coreSrcPath,
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.join(corePackagePath, 'src'),
            '@shellui/sdk': path.join(sdkPackagePath, 'src/index.ts'),
          },
        },
        build: {
          write: false,
          sourcemap: false, // Disable source maps for service worker in dev mode
          rollupOptions: {
            input: swPath,
            output: {
              format: 'es',
              entryFileNames: 'sw.js',
            },
          },
        },
      });

      // Extract the built code from the output
      // Vite build with write: false returns a RollupOutput object with output array
      let outputChunk = null;

      if (result && Array.isArray(result) && result.length > 0) {
        // Handle array format (multiple outputs)
        const buildOutput = result[0];
        if (buildOutput && buildOutput.output && Array.isArray(buildOutput.output)) {
          outputChunk = buildOutput.output.find((o) => o.type === 'chunk');
        }
      } else if (result && result.output && Array.isArray(result.output)) {
        // Handle single output format
        outputChunk = result.output.find((o) => o.type === 'chunk');
      } else if (result && result.code) {
        // Handle direct code format (unlikely but possible)
        outputChunk = { code: result.code };
      }

      if (outputChunk && outputChunk.code) {
        // Strip any source map references from the code
        // This prevents browser devtools from trying to load non-existent source maps
        swCode = outputChunk.code.replace(/\/\/# sourceMappingURL=.*$/gm, '');
        console.log('✓ Dev service worker built successfully');
      } else {
        buildError = `Service worker build completed but no output chunk found. Result type: ${typeof result}, isArray: ${Array.isArray(result)}`;
        console.warn(buildError);
        console.warn('Build result structure:', JSON.stringify(Object.keys(result || {}), null, 2));
      }
    } catch (error) {
      buildError = error.message;
      console.error('Failed to build dev service worker:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } finally {
      isBuilding = false;
    }
  }

  return {
    name: 'shellui-service-worker-dev',
    async buildStart() {
      // Try to build immediately when plugin loads
      await buildServiceWorker();
    },
    configureServer(server) {
      // Also build when server is ready (in case buildStart was too early)
      server.httpServer?.once('listening', async () => {
        if (!swCode && !buildError) {
          await buildServiceWorker();
        }
      });

      // Handle source map requests first - return empty source map instead of 404
      // This prevents browser devtools from showing errors when source maps don't exist
      // (e.g., from React DevTools or other browser extensions)
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.endsWith('.map')) {
          // Return a valid but empty source map to satisfy devtools
          // This prevents errors while still disabling source maps in dev mode
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              version: 3,
              sources: [],
              names: [],
              mappings: '',
              file: req.url.replace('.map', ''),
            }),
          );
          return;
        }
        next();
      });

      // Serve the service worker at /sw.js
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/sw.js' || req.url.startsWith('/sw.js?')) {
          // Ensure it's built (try one more time if not ready)
          if (!swCode && !buildError) {
            await buildServiceWorker();
          }

          if (swCode) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.end(swCode);
          } else {
            res.statusCode = 404;
            const errorMsg = buildError || 'Service worker not available';
            res.end(`// ${errorMsg}\n// Service worker build failed or not ready`);
          }
        } else {
          next();
        }
      });
    },
  };
}
