import path from 'path';
import { resolvePackagePath } from './index.js';

/**
 * Get the path to the core package source directory
 * @returns {string} Absolute path to core package src directory
 */
export function getCoreSrcPath() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  return path.join(corePackagePath, 'src');
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

  const sentry = config?.sentry;
  return {
    '__SHELLUI_CONFIG__': JSON.stringify(serializableConfig),
    '__SHELLUI_SENTRY_DSN__': sentry?.dsn ? JSON.stringify(sentry.dsn) : 'undefined',
    '__SHELLUI_SENTRY_ENVIRONMENT__': sentry?.environment ? JSON.stringify(sentry.environment) : 'undefined',
    '__SHELLUI_SENTRY_RELEASE__': sentry?.release ? JSON.stringify(sentry.release) : 'undefined',
  };
}

