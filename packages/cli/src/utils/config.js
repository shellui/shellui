import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadTypeScriptConfig } from './config-loaders.js';

/**
 * Merge Sentry config from env into the loaded config. Only adds sentry when
 * SENTRY_DSN is set and Sentry is not disabled via SENTRY_ENABLED=false|0.
 * @param {Object} config - Loaded config object
 * @returns {Object} Config with sentry merged from env when enabled
 */
function mergeSentryFromEnv(config) {
  const dsn = process.env.SENTRY_DSN;
  const enabled = process.env.SENTRY_ENABLED;
  if (!dsn || enabled === 'false' || enabled === '0') {
    return config;
  }
  return {
    ...config,
    sentry: {
      dsn,
      ...(process.env.SENTRY_ENVIRONMENT && { environment: process.env.SENTRY_ENVIRONMENT }),
      ...(process.env.SENTRY_RELEASE && { release: process.env.SENTRY_RELEASE }),
    },
  };
}

/**
 * Load configuration from shellui.config.ts file. Sentry is merged from env on load
 * (SENTRY_DSN, SENTRY_ENABLED, SENTRY_ENVIRONMENT, SENTRY_RELEASE).
 * @param {string} root - Root directory to search for config (default: current working directory)
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);
  const tsConfigPath = path.join(configDir, 'shellui.config.ts');

  let config = {};

  if (fs.existsSync(tsConfigPath)) {
    try {
      config = await loadTypeScriptConfig(tsConfigPath, configDir);
    } catch (e) {
      console.error(pc.red(`Failed to load config from ${tsConfigPath}: ${e.message}`));
      if (e.stack) {
        console.error(pc.red(e.stack));
      }
    }
  } else {
    console.log(pc.yellow(`No shellui.config.ts found, using defaults.`));
  }

  const merged = mergeSentryFromEnv(config);
  warnStartUrlAndRootNav(merged);
  return merged;
}

/**
 * If both start_url and a root nav item (path '' or '/') are set, warn that start_url wins.
 * @param {Object} config - Loaded config object
 */
function warnStartUrlAndRootNav(config) {
  const startUrl = config?.start_url?.trim();
  if (!startUrl) return;
  const nav = config?.navigation;
  if (!nav?.length) return;
  const hasRootNav = nav.some((item) => {
    if (item.title != null && item.items) {
      return item.items.some((i) => i.path === '' || i.path === '/');
    }
    return item.path === '' || item.path === '/';
  });
  if (hasRootNav) {
    console.warn(
      pc.yellow(
        '⚠ start_url is set and a navigation item has path "/" or "". Visiting "/" will redirect to start_url; the root nav item will not be shown at "/".',
      ),
    );
  }
}
