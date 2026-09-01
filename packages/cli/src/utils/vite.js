import path from 'path';
import fs from 'fs';
import tailwindcssPlugin from '@tailwindcss/postcss';
import autoprefixerPlugin from 'autoprefixer';
import { resolvePackagePath, resolveSdkEntry } from './index.js';
import { prepareFrontendConfig } from './config-env.js';

/**
 * Get the path to the core package source directory
 * Works in both workspace mode (monorepo) and npm-installed mode
 * @returns {string} Absolute path to core package src directory
 */
export function getCoreSrcPath() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  const srcPath = path.join(corePackagePath, 'src');

  // Verify src directory exists (should always exist since it's in package.json files)
  if (!fs.existsSync(srcPath)) {
    throw new Error(
      `Core package src directory not found at ${srcPath}. ` +
        `Make sure @shellui/core is properly installed and includes the src directory.`,
    );
  }

  // Verify index.html exists (required for dev server)
  const indexHtmlPath = path.join(srcPath, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(
      `Core package index.html not found at ${indexHtmlPath}. ` +
        `Make sure @shellui/core is properly installed.`,
    );
  }

  return srcPath;
}

const SHELLUI_CONFIG_VIRTUAL_ID = 'virtual:shellui-config';
const SHELLUI_CONFIG_ALIAS_ID = '\0' + SHELLUI_CONFIG_VIRTUAL_ID;

/**
 * Resolve build target from CLI flag/env or legacy config.runtime field.
 * @param {Object} config - Loaded shellui config
 * @returns {'web' | 'tauri'}
 */
export function resolveShelluiTarget(config) {
  const fromEnv = process.env.SHELLUI_TARGET;
  if (fromEnv === 'tauri' || fromEnv === 'web') return fromEnv;
  if (config?.runtime === 'tauri') return 'tauri';
  return 'web';
}

/**
 * Vite define for the Shellui build target injected into @shellui/core.
 * @param {Object} config - Loaded shellui config
 * @returns {Record<string, string>}
 */
export function getShelluiTargetDefine(config) {
  return { __SHELLUI_TARGET__: JSON.stringify(resolveShelluiTarget(config)) };
}

/**
 * Create Vite plugin that provides the Shellui config as a virtual module.
 * Injects a frozen snapshot (env already resolved by loadConfig). The browser
 * cannot override env placeholders at runtime.
 * @param {Object} config - Loaded shellui config (will be serialized for the virtual module)
 * @returns {import('vite').Plugin}
 */
export function createShelluiConfigPlugin(config) {
  const serializableConfig = prepareFrontendConfig(config);
  const moduleContent = `export const shelluiConfig = ${JSON.stringify(serializableConfig)};
export default shelluiConfig;
`;
  const themesDirAbs = config?.__themesDirAbs;

  return {
    name: 'shellui-config',
    resolveId(id) {
      if (id === SHELLUI_CONFIG_VIRTUAL_ID) {
        return SHELLUI_CONFIG_ALIAS_ID;
      }
      return null;
    },
    load(id) {
      if (id === SHELLUI_CONFIG_ALIAS_ID) {
        return moduleContent;
      }
      return null;
    },
    configureServer(server) {
      if (!themesDirAbs) return;
      server.middlewares.use('/themes', (req, res, next) => {
        try {
          const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
          const filePath = path.join(themesDirAbs, urlPath.replace(/^\//, ''));
          if (
            !filePath.startsWith(themesDirAbs) ||
            !fs.existsSync(filePath) ||
            !fs.statSync(filePath).isFile()
          ) {
            next();
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          const types = {
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf',
            '.css': 'text/css',
            '.json': 'application/json',
          };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    closeBundle() {
      // no-op; build copy handled separately when needed
    },
  };
}

/**
 * Resolve alias for Shellui config. Use together with createShelluiConfigPlugin so that
 * imports like "import shelluiConfig from '@shellui/config'" resolve to the virtual module.
 * @returns {Object} Vite resolve.alias entry for @shellui/config
 */
export function getShelluiConfigAlias() {
  return {
    '@shellui/config': SHELLUI_CONFIG_VIRTUAL_ID,
  };
}

/**
 * Create Vite resolve.alias configuration.
 * Sets '@shellui/sdk' to source entry when in workspace mode; omits the alias
 * when installed from npm so Vite resolves through the package's exports field (dist/index.js).
 * @returns {Object} Vite resolve.alias object
 */
export function createResolveAlias() {
  const sdkEntry = resolveSdkEntry();

  const alias = {};

  if (sdkEntry) {
    alias['@shellui/sdk'] = sdkEntry;
  }

  return alias;
}

/** Vite prebundle cache — never `node_modules/.vite` (the consumer app's default). */
export const SHELLUI_VITE_CACHE_DIR = '.vite-shellui';

/**
 * esbuild options that skip walking up to the consumer `tsconfig.json`.
 * Matches @shellui/core JSX settings.
 */
const SHELLUI_ESBUILD_TSCONFIG_RAW = {
  compilerOptions: {
    target: 'ES2020',
    jsx: 'automatic',
    jsxImportSource: 'react',
    useDefineForClassFields: true,
    module: 'ESNext',
    moduleResolution: 'bundler',
    skipLibCheck: true,
  },
};

/**
 * Create PostCSS configuration for Vite.
 * Provides Tailwind CSS v4 and autoprefixer plugins programmatically so the
 * CLI owns all CSS build dependencies.
 * `scanBaseDir` is required — `@tailwindcss/postcss` defaults `base` to cwd,
 * which would scan the consumer project.
 * @param {string} scanBaseDir - Tailwind class scan root (core `src/`)
 * @returns {Object} PostCSS configuration for Vite's css.postcss option
 */
export function createPostCSSConfig(scanBaseDir) {
  if (!scanBaseDir) {
    throw new Error(
      'createPostCSSConfig requires scanBaseDir (core src). Refusing to default Tailwind base to cwd.',
    );
  }
  return {
    plugins: [
      tailwindcssPlugin({ base: scanBaseDir }),
      autoprefixerPlugin({ overrideBrowserslist: ['defaults'] }),
    ],
  };
}

/**
 * Create Vite resolve configuration.
 * @returns {Object} Vite resolve configuration
 */
export function createViteResolveConfig() {
  return {};
}

/**
 * Vite cache directory for the shell (under the consumer project, not shared with the app).
 * @param {string} projectRoot
 * @returns {string}
 */
export function getShelluiViteCacheDir(projectRoot) {
  return path.resolve(projectRoot, 'node_modules', SHELLUI_VITE_CACHE_DIR);
}

/**
 * Inline Vite config that never loads the consumer project's tooling:
 * `vite.config.*`, `postcss.config.*`, `tsconfig.json`, or `.env` / `VITE_*`.
 * The shell only reads `shellui.config.*` and `static/`.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string} opts.coreSrcPath
 * @param {string} opts.corePackagePath
 * @param {object} [opts.shelluiConfig]
 * @returns {import('vite').InlineConfig}
 */
export function createIsolatedViteConfig({
  projectRoot,
  coreSrcPath,
  corePackagePath,
  shelluiConfig,
}) {
  const cacheDir = getShelluiViteCacheDir(projectRoot);
  const staticPath = path.join(projectRoot, 'static');
  const publicDir = fs.existsSync(staticPath) ? staticPath : false;
  const nodeModulesDir = path.join(projectRoot, 'node_modules');
  const fsAllow = [corePackagePath, nodeModulesDir, cacheDir];
  if (publicDir) fsAllow.push(staticPath);
  if (shelluiConfig?.__themesDirAbs) fsAllow.push(shelluiConfig.__themesDirAbs);

  return {
    configFile: false,
    envDir: false,
    envPrefix: 'SHELLUI_PUBLIC_',
    root: coreSrcPath,
    cacheDir,
    publicDir,
    css: {
      postcss: createPostCSSConfig(coreSrcPath),
    },
    esbuild: {
      tsconfigRaw: SHELLUI_ESBUILD_TSCONFIG_RAW,
    },
    optimizeDeps: {
      esbuildOptions: {
        tsconfigRaw: SHELLUI_ESBUILD_TSCONFIG_RAW,
      },
    },
    define: getShelluiTargetDefine(shelluiConfig),
    resolve: {
      ...createViteResolveConfig(),
      alias: {
        ...createResolveAlias(),
        ...getShelluiConfigAlias(),
        '@shellui/core': corePackagePath,
      },
    },
    server: {
      fs: {
        strict: true,
        allow: fsAllow,
      },
    },
    build: {
      cssMinify: 'esbuild',
    },
  };
}
