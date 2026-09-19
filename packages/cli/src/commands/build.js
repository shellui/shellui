import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { injectManifest } from 'workbox-build';
import {
  loadConfig,
  getCoreSrcPath,
  createShelluiConfigPlugin,
  createIsolatedViteConfig,
  resolvePackagePath,
  writeGeneratedFrontendConfig,
} from '../utils/index.js';
import { tauriBuildCommand } from '../utils/tauri.js';
import { getWebDistDir, getProjectRoot } from '../utils/paths.js';
import { prepareBuildEnvironment } from '../utils/project-env.js';

/**
 * Normalize a URL path for dist subfolders (no leading/trailing slashes, no traversal).
 * @param {string} routePath
 * @returns {string | null}
 */
export function normalizeRoutePath(routePath) {
  if (typeof routePath !== 'string') return null;
  const normalized = routePath.replace(/^\/+|\/+$/g, '').trim();
  if (!normalized || normalized.includes('..')) return null;
  return normalized;
}

/**
 * Collect all unique path values from navigation config (items and nested groups).
 * Returns paths normalized (no leading/trailing slashes, no empty).
 * @param {Array<{ path?: string; items?: Array<{ path?: string }> }>} navigation - Config navigation array
 * @returns {string[]} Unique path segments safe for dist subfolders
 */
export function getNavigationPaths(navigation) {
  if (!Array.isArray(navigation)) return [];
  const paths = new Set();
  for (const item of navigation) {
    if (!item || typeof item !== 'object') continue;
    if ('path' in item && typeof item.path === 'string') {
      const normalized = normalizeRoutePath(item.path);
      if (normalized) paths.add(normalized);
    }
    if (Array.isArray(item.items)) {
      for (const sub of item.items) {
        if (sub && typeof sub.path === 'string') {
          const normalized = normalizeRoutePath(sub.path);
          if (normalized) paths.add(normalized);
        }
      }
    }
  }
  return [...paths];
}

/** Fallback when @shellui/core constants/urls.ts is unavailable (keep in sync). */
const SHELL_BUILTIN_ROUTE_FALLBACK = [
  '__settings',
  '__cookie-preferences',
  '__overlay-demo',
  '__chrome-actions-demo',
  'login',
  'login/callback',
  'admin',
  'legal',
  'legal/privacy-policy',
  'legal/terms-of-service',
  'legal/legal-notice',
  'legal/data-processing-agreement',
];

/**
 * Shell React routes from @shellui/core/src/constants/urls.ts (login, settings, legal, …).
 * Parsed at build time so the CLI does not need to import TypeScript sources.
 * @param {string} corePackagePath - Resolved @shellui/core package root
 * @returns {string[]}
 */
export function getShellBuiltinRoutePaths(corePackagePath) {
  const urlsPath = path.join(corePackagePath, 'src', 'constants', 'urls.ts');
  if (!fs.existsSync(urlsPath)) {
    return [...SHELL_BUILTIN_ROUTE_FALLBACK];
  }

  const source = fs.readFileSync(urlsPath, 'utf-8');
  const paths = new Set();
  for (const match of source.matchAll(/:\s*'(\/[^']*)'/g)) {
    const normalized = normalizeRoutePath(match[1]);
    if (normalized) paths.add(normalized);
  }

  return paths.size > 0 ? [...paths].sort() : [...SHELL_BUILTIN_ROUTE_FALLBACK];
}

/**
 * Optional admin pathname override from shell config (defaults to urls.admin).
 * @param {{ backend?: { adminPathname?: string } }} config
 * @returns {string | null}
 */
function getConfigAdminRoutePath(config) {
  const configured = config?.backend?.adminPathname?.trim();
  if (!configured || !configured.startsWith('/')) return null;
  return normalizeRoutePath(configured);
}

/**
 * Union of navigation paths and shell built-in routes to materialize as dist/<path>/index.html.
 * @param {Array<{ path?: string; items?: Array<{ path?: string }> }>} navigation
 * @param {string} corePackagePath
 * @param {{ backend?: { adminPathname?: string } }} [config]
 * @returns {string[]}
 */
export function getMaterializedRoutePaths(navigation, corePackagePath, config = {}) {
  const paths = new Set([
    ...getShellBuiltinRoutePaths(corePackagePath),
    ...getNavigationPaths(navigation),
  ]);
  const adminOverride = getConfigAdminRoutePath(config);
  if (adminOverride) paths.add(adminOverride);
  return [...paths].sort();
}

/**
 * Rewrite root-relative-to-index asset references (emitted by Vite `base: './'`)
 * so a copy of index.html placed `depth` folders deep still resolves assets.
 * A file at `dist/web/<seg1>/<seg2>/index.html` must reach `dist/web/assets/...`
 * via `../../assets/...`. Without this, hosts that serve `/<path>/` with a
 * trailing slash resolve `./assets` under the subfolder and 404.
 * @param {string} html - index.html content built with relative base
 * @param {number} depth - number of path segments the copy is nested under
 * @returns {string}
 */
export function rewriteRelativeAssetDepth(html, depth) {
  if (depth <= 0) return html;
  const prefix = '../'.repeat(depth);
  // Match attribute values that start with `./` (e.g. src="./assets/…", href='./favicon.svg').
  return html.replace(/(\s(?:src|href)=)(["'])\.\//g, `$1$2${prefix}`);
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

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
 * Build command - Builds the Shellui application for production
 * @param {string} root - Root directory (default: '.')
 * @param {{ app?: boolean; target?: string; bundles?: string; config?: string }} options - Command options
 */
export async function buildCommand(root = '.', options = {}) {
  const cwd = process.cwd();
  const projectRoot = getProjectRoot(root, cwd);
  applyTargetOption(options);

  if (options?.app) {
    await tauriBuildCommand(root, { bundles: options.bundles, config: options.config });
    return;
  }

  console.log(pc.blue(`Building Shellui...`));

  // Set environment variable to indicate this is a build
  // This allows shellui.config.ts (advanced) to detect build mode and generate build ID
  process.env.SHELLUI_BUILD = 'true';
  process.env.NODE_ENV = 'production';

  prepareBuildEnvironment(projectRoot);

  // Load configuration
  const config = await loadConfig(root, { config: options.config });

  // Log config summary for debugging
  console.log(pc.blue(`Config loaded:`));
  console.log(pc.gray(`  - Title: ${config.title || '(not set)'}`));
  console.log(pc.gray(`  - Navigation items: ${config.navigation?.length || 0}`));
  console.log(pc.gray(`  - Layout: ${config.layout || 'sidebar'}`));

  // Verify config is serializable
  try {
    const testSerialize = JSON.parse(JSON.stringify(config));
    console.log(pc.green(`  ✓ Config is serializable`));
  } catch (e) {
    console.error(pc.red(`  ✗ Config is not serializable: ${e.message}`));
    throw e;
  }

  // Get core package paths
  const corePackagePath = resolvePackagePath('@shellui/core');
  const coreSrcPath = getCoreSrcPath();
  const isolated = createIsolatedViteConfig({
    projectRoot,
    coreSrcPath,
    corePackagePath,
    shelluiConfig: config,
  });
  const distPath = getWebDistDir(root, cwd);

  try {
    // Build main app
    await build({
      ...isolated,
      plugins: [react(), createShelluiConfigPlugin(config)],
      build: {
        ...isolated.build,
        outDir: distPath,
        emptyOutDir: true,
        sourcemap: true,
        // Ensure every build generates unique filenames with content hashes
        // Content hash changes when file content changes, ensuring cache busting
        rollupOptions: {
          input: {
            main: path.join(coreSrcPath, 'index.html'),
          },
          output: {
            // Use content hash in filenames for cache busting
            // [hash] is based on file content, so same content = same hash
            // Different content = different hash, ensuring unique filenames per build when content changes
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
      },
    });

    // Build service worker with Vite first
    console.log(pc.blue('Building service worker...'));
    const swInputPath = path.join(corePackagePath, 'src', 'service-worker', 'sw.ts');
    const swTempPath = path.join(distPath, 'sw-temp.js');

    // Build service worker TypeScript to JavaScript
    await build({
      ...isolated,
      publicDir: false,
      plugins: [createShelluiConfigPlugin(config)],
      build: {
        ...isolated.build,
        outDir: distPath,
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
          input: swInputPath,
          output: {
            dir: distPath,
            entryFileNames: 'sw-temp.js',
            format: 'es',
          },
        },
        write: true,
      },
    });

    // Use workbox-build to inject manifest
    const { count, size, warnings } = await injectManifest({
      swSrc: swTempPath,
      swDest: path.join(distPath, 'sw.js'),
      globDirectory: distPath,
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,ico}'],
      // Don't precache the service worker itself or source maps
      globIgnores: ['sw.js', 'sw-temp.js', '**/*.map', '**/node_modules/**'],
      // Maximum file size to precache (5MB)
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    });

    // Remove temporary file
    if (fs.existsSync(swTempPath)) {
      fs.unlinkSync(swTempPath);
    }

    if (warnings.length > 0) {
      warnings.forEach((warning) => console.warn(pc.yellow(`Warning: ${warning}`)));
    }

    console.log(
      pc.green(
        `Service worker generated: ${count} files precached (${(size / 1024).toFixed(2)} KB)`,
      ),
    );

    // Copy static folder contents to dist if it exists
    // This ensures icons are served from the same path in dev and prod
    const staticPath = path.join(projectRoot, 'static');

    if (fs.existsSync(staticPath)) {
      console.log(pc.blue('Copying static assets...'));
      // Copy contents of static directly to dist (not dist/static)
      // This way /icons/... works in both dev and prod
      copyDir(staticPath, distPath);
      console.log(pc.green('Static assets copied!'));
    }

    // Copy index.html to 404.html for SPA routing support
    // This allows hosting providers (like Netlify, Vercel) to serve index.html for all routes
    const indexPath = path.join(distPath, 'index.html');
    const notFoundPath = path.join(distPath, '404.html');

    if (fs.existsSync(indexPath)) {
      console.log(pc.blue('Creating 404.html for SPA routing...'));
      fs.copyFileSync(indexPath, notFoundPath);
      console.log(pc.green('404.html created!'));

      // Materialize dist/<path>/index.html for shell built-ins (login/callback, settings, …)
      // and navigation paths so static hosts return 200 with correct relative asset depth.
      const routePaths = getMaterializedRoutePaths(config.navigation, corePackagePath, config);
      if (routePaths.length > 0) {
        console.log(pc.blue(`Creating route folders for ${routePaths.length} path(s)...`));
        const indexHtml = fs.readFileSync(indexPath, 'utf-8');
        for (const routePath of routePaths) {
          const routeDir = path.join(distPath, routePath);
          const routeIndexPath = path.join(routeDir, 'index.html');
          if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, { recursive: true });
          }
          // Relative `base: './'` assets must climb back to dist/web for nested routes
          // so `/<path>/` (trailing slash) serving still resolves them.
          const depth = routePath.split('/').filter(Boolean).length;
          fs.writeFileSync(routeIndexPath, rewriteRelativeAssetDepth(indexHtml, depth), 'utf-8');
        }
        console.log(pc.green(`Route folders created: ${routePaths.join(', ')}`));
      }
    }

    console.log(pc.green(`Build complete! Output: dist/web/`));

    // Write resolved config snapshot for the frontend (env already substituted; not overridable at runtime).
    // This file is public — do not put secrets in shellui config.
    const { filePath: generatedConfigPath } = writeGeneratedFrontendConfig(distPath, config);
    console.log(
      pc.green(
        `Wrote resolved frontend config: ${generatedConfigPath} (env placeholders baked in; no runtime overrides)`,
      ),
    );
  } catch (e) {
    console.error(pc.red(`Error building: ${e.message}`));
    process.exit(1);
  }
}
