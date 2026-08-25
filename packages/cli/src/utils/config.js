import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadTypeScriptConfig } from './config-loaders.js';
import {
  MAIN_CONFIG_FILE,
  discoverConfigMode,
  resolveConfigLocation,
  getConfigPathOption,
  stripSchemaKey,
} from './config-paths.js';
import { validateConfig } from './config-validate.js';
import { mergeSplitConfigs, readJsonConfigFile } from './config-split.js';
import { substituteEnvInConfig } from './config-env.js';
import { resolveConfigThemes } from './resolve-themes.js';

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
 * Apply ${ENV} substitution to all string values in the config.
 * @param {Object} config
 * @returns {Object}
 */
function applyEnvSubstitution(config) {
  const { value, missing } = substituteEnvInConfig(config);
  if (missing.length) {
    console.warn(
      pc.yellow(
        `⚠ Config references unset environment variable(s) with no default: ${missing.join(', ')}. ` +
          `They were replaced with an empty string. Use \${VAR:-default} to provide a fallback.`,
      ),
    );
  }
  return /** @type {Object} */ (value);
}

/**
 * Normalize loadConfig second argument (legacy string path or options object).
 * @param {string | { config?: string }} [configOrOptions]
 * @returns {string | undefined}
 */
function normalizeConfigPathArg(configOrOptions) {
  if (configOrOptions == null) return getConfigPathOption({});
  if (typeof configOrOptions === 'string') return configOrOptions;
  return getConfigPathOption(configOrOptions);
}

/**
 * Load configuration (JSON-first, then split, then TypeScript advanced).
 * Applies ${ENV} substitution in string values, then validates against the
 * ShellUIConfig JSON Schema. Sentry is merged from env after validation.
 *
 * @param {string} root - Project root directory (default: current working directory)
 * @param {string | { config?: string }} [configOrOptions] - `--config` path (file or directory), or options
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(root = '.', configOrOptions) {
  const configPath = normalizeConfigPathArg(configOrOptions);
  const location = resolveConfigLocation(root, configPath);
  const { configDir, mainPath, tsPath } = location;

  let discovery;
  try {
    discovery = discoverConfigMode(configDir, { mainPath, tsPath });
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
      console.log(pc.green(`Loaded split config from ${configDir}: ${names}`));
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
      pc.yellow(
        `No ${MAIN_CONFIG_FILE} (or split / TypeScript config) found in ${configDir}, using defaults.`,
      ),
    );
  }

  if (sourceLabel) {
    config = applyEnvSubstitution(config);
    try {
      config = validateConfig(config, { source: sourceLabel });
    } catch (e) {
      console.error(pc.red(e.message));
      throw e;
    }
  }

  const merged = mergeSentryFromEnv(config);
  warnStartUrlAndRootNav(merged);
  return resolveConfigThemes(merged, {
    configDir,
    projectRoot: location.projectRoot,
  });
}

/**
 * Resolve which config paths should be watched for changes.
 * @param {string} root
 * @param {string | { config?: string }} [configOrOptions]
 * @returns {string[]}
 */
export function getWatchableConfigPaths(root = '.', configOrOptions) {
  const configPath = normalizeConfigPathArg(configOrOptions);
  const { configDir, mainPath, tsPath } = resolveConfigLocation(root, configPath);
  try {
    const discovery = discoverConfigMode(configDir, { mainPath, tsPath });
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
 * @param {string | { config?: string }} [configOrOptions]
 * @returns {boolean}
 */
export function hasAnyConfig(root = '.', configOrOptions) {
  const configPath = normalizeConfigPathArg(configOrOptions);
  const { configDir, mainPath, tsPath } = resolveConfigLocation(root, configPath);
  try {
    const discovery = discoverConfigMode(configDir, { mainPath, tsPath });
    return discovery.mode !== 'none';
  } catch {
    // Conflict still means config files exist
    return true;
  }
}
