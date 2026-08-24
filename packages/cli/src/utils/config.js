import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadTypeScriptConfig } from './config-loaders.js';
import { MAIN_CONFIG_FILE, discoverConfigMode, stripSchemaKey } from './config-paths.js';
import { validateConfig } from './config-validate.js';
import { mergeSplitConfigs, readJsonConfigFile } from './config-split.js';

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

/**
 * Load configuration (JSON-first, then split, then TypeScript advanced).
 * Validates against the ShellUIConfig JSON Schema. Sentry is merged from env.
 * @param {string} root - Root directory to search for config (default: current working directory)
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);

  let discovery;
  try {
    discovery = discoverConfigMode(configDir);
  } catch (e) {
    console.error(pc.red(e.message));
    throw e;
  }

  let config = {};
  let sourceLabel = null;

  if (discovery.mode === 'main') {
    try {
      const parsed = readJsonConfigFile(discovery.mainPath);
      config = stripSchemaKey(parsed);
      sourceLabel = discovery.mainPath;
      console.log(pc.green(`Loaded JSON config from ${discovery.mainPath}`));
    } catch (e) {
      console.error(pc.red(e.message));
      throw e;
    }
  } else if (discovery.mode === 'split') {
    try {
      config = mergeSplitConfigs(discovery.splitFiles);
      sourceLabel = 'split configs';
      const names = discovery.splitFiles.map((f) => f.fileName).join(', ');
      console.log(pc.green(`Loaded split config from ${names}`));
    } catch (e) {
      console.error(pc.red(e.message));
      throw e;
    }
  } else if (discovery.mode === 'ts') {
    try {
      config = await loadTypeScriptConfig(discovery.tsPath, configDir);
      sourceLabel = discovery.tsPath;
    } catch (e) {
      console.error(pc.red(`Failed to load config from ${discovery.tsPath}: ${e.message}`));
      if (e.stack) {
        console.error(pc.red(e.stack));
      }
      config = {};
      sourceLabel = null;
    }
  } else {
    console.log(
      pc.yellow(`No ${MAIN_CONFIG_FILE} (or split / TypeScript config) found, using defaults.`),
    );
  }

  if (sourceLabel) {
    try {
      config = validateConfig(config, { source: sourceLabel });
    } catch (e) {
      console.error(pc.red(e.message));
      throw e;
    }
  }

  const merged = mergeSentryFromEnv(config);
  warnStartUrlAndRootNav(merged);
  return merged;
}

/**
 * Resolve which config paths should be watched for changes.
 * @param {string} root
 * @returns {string[]}
 */
export function getWatchableConfigPaths(root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);
  try {
    const discovery = discoverConfigMode(configDir);
    if (discovery.mode === 'main') return [discovery.mainPath];
    if (discovery.mode === 'split') return discovery.splitFiles.map((f) => f.path);
    if (discovery.mode === 'ts') return [discovery.tsPath];
  } catch {
    // Mode conflict — nothing useful to watch until resolved
  }
  return [];
}

/**
 * Whether any supported config exists (JSON, split, or TS).
 * @param {string} root
 * @returns {boolean}
 */
export function hasAnyConfig(root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);
  try {
    const discovery = discoverConfigMode(configDir);
    return discovery.mode !== 'none';
  } catch {
    // Conflict still means config files exist
    return true;
  }
}
