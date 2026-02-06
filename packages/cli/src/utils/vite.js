import path from 'path';
import tailwindcssPlugin from '@tailwindcss/postcss';
import autoprefixerPlugin from 'autoprefixer';
import { resolvePackagePath, resolveSdkEntry } from './index.js';

/**
 * Get the path to the core package source directory
 * @returns {string} Absolute path to core package src directory
 */
export function getCoreSrcPath() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  return path.join(corePackagePath, 'src');
}

/**
 * Create Vite resolve.alias configuration.
 * Always sets '@' to core/src. Sets '@shellui/sdk' to source entry when in
 * workspace mode; omits the alias when installed from npm so Vite resolves
 * through the package's exports field (dist/index.js).
 * @returns {Object} Vite resolve.alias object
 */
export function createResolveAlias() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  const sdkEntry = resolveSdkEntry();

  const alias = {
    '@': path.join(corePackagePath, 'src'),
  };

  if (sdkEntry) {
    alias['@shellui/sdk'] = sdkEntry;
  }

  return alias;
}

/**
 * Create PostCSS configuration for Vite.
 * Provides Tailwind CSS v4 and autoprefixer plugins programmatically so the
 * CLI owns all CSS build dependencies — core doesn't need to ship postcss.config
 * or have CSS tooling in its own dependencies.
 * @returns {Object} PostCSS configuration for Vite's css.postcss option
 */
export function createPostCSSConfig() {
  return {
    plugins: [tailwindcssPlugin(), autoprefixerPlugin()],
  };
}

/**
 * Create Vite define configuration for ShellUI config injection
 * App config is in __SHELLUI_CONFIG__; Sentry is in three separate globals
 * (__SHELLUI_SENTRY_DSN__, __SHELLUI_SENTRY_ENVIRONMENT__, __SHELLUI_SENTRY_RELEASE__).
 * @param {Object} config - Configuration object
 * @returns {Object} Vite define configuration
 */
export function createViteDefine(config) {
  // Ensure config is serializable; omit sentry so it is only in the three Sentry globals
  const serializableConfig = JSON.parse(JSON.stringify(config));
  delete serializableConfig.sentry;

  // Verify navigation is preserved after serialization
  if (config.navigation && !serializableConfig.navigation) {
    console.warn('Warning: Navigation was lost during serialization. This should not happen.');
  }

  const sentry = config?.sentry;
  // Double-stringify: Vite's define inserts the value as-is into the code
  // If we pass '{"title":"shellui"}', Vite inserts it as: const x = {"title":"shellui"}; (invalid - object literal)
  // If we pass '"{\"title\":\"shellui\"}"', Vite inserts it as: const x = "{\"title\":\"shellui\"}"; (valid - string literal)
  // So we need to double-stringify to ensure it's inserted as a string
  const configString = JSON.stringify(JSON.stringify(serializableConfig));

  return {
    __SHELLUI_CONFIG__: configString,
    __SHELLUI_SENTRY_DSN__: sentry?.dsn ? JSON.stringify(sentry.dsn) : 'undefined',
    __SHELLUI_SENTRY_ENVIRONMENT__: sentry?.environment
      ? JSON.stringify(sentry.environment)
      : 'undefined',
    __SHELLUI_SENTRY_RELEASE__: sentry?.release ? JSON.stringify(sentry.release) : 'undefined',
  };
}
