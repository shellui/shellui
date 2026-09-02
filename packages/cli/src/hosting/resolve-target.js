import path from 'path';
import { substituteEnvInConfig } from '../utils/config-env.js';
import {
  discoverConfigMode,
  findProjectConfigDir,
  getConfigPathOption,
  resolveConfigLocation,
  stripSchemaKey,
} from '../utils/config-paths.js';
import { mergeSplitConfigs, readJsonConfigFile } from '../utils/config-split.js';

/**
 * Quietly read config fields needed for CLI hosting (no validation logs).
 * Supports main JSON and split configs (not TypeScript).
 * @param {string} configDir
 * @returns {{ hosting: { url?: string, slug?: string } | null } | null}
 */
export function peekHostingConfigFromDir(configDir) {
  try {
    const discovery = discoverConfigMode(configDir);
    /** @type {Record<string, unknown>} */
    let config = {};
    if (discovery.mode === 'main') {
      config = stripSchemaKey(readJsonConfigFile(discovery.mainPath));
    } else if (discovery.mode === 'split') {
      config = mergeSplitConfigs(discovery.splitFiles);
    } else {
      return null;
    }
    const { value } = substituteEnvInConfig(config);
    const hosting =
      value?.hosting && typeof value.hosting === 'object'
        ? /** @type {{ url?: string, slug?: string, app?: string }} */ (value.hosting)
        : null;
    return { hosting };
  } catch {
    return null;
  }
}

/**
 * @param {string} [startDir]
 * @param {{ config?: string }} [options]
 * @returns {{
 *   hosting: { url?: string, slug?: string } | null,
 *   configDir: string | null,
 * }}
 */
export function peekHostingFromConfig(startDir = '.', options = {}) {
  const explicit = getConfigPathOption(options);
  if (explicit) {
    try {
      const location = resolveConfigLocation(startDir, explicit);
      const peeked = peekHostingConfigFromDir(location.configDir);
      return {
        hosting: peeked?.hosting ?? null,
        configDir: location.configDir,
      };
    } catch {
      return { hosting: null, configDir: null };
    }
  }

  const found = findProjectConfigDir(path.resolve(startDir));
  if (!found) {
    return { hosting: null, configDir: null };
  }
  const peeked = peekHostingConfigFromDir(found);
  return {
    hosting: peeked?.hosting ?? null,
    configDir: found,
  };
}

/**
 * @param {{
 *   root?: string,
 *   config?: string,
 *   slug?: string,
 * }} [options]
 */
export function resolveHostingTarget(options = {}) {
  const startDir = path.resolve(options.root ?? '.');
  const { hosting: fromConfig, configDir } = peekHostingFromConfig(startDir, {
    config: options.config,
  });

  const hostingUrlRaw =
    typeof fromConfig?.url === 'string' && fromConfig.url.trim() ? fromConfig.url.trim() : '';

  const slugFromConfig =
    typeof fromConfig?.slug === 'string' && fromConfig.slug.trim() ? fromConfig.slug.trim() : '';

  const slugOverride =
    typeof options.slug === 'string' && options.slug.trim() ? options.slug.trim() : '';

  return {
    hostingUrl: hostingUrlRaw.replace(/\/$/, ''),
    slug: slugOverride || slugFromConfig,
    configDir,
  };
}

/**
 * @param {{
 *   hostingUrl: string,
 *   slug?: string,
 *   configDir?: string | null,
 * }} target
 * @param {{ requireSlug?: boolean }} [options]
 * @returns {string | null}
 */
export function validateHostingTarget(target, options = {}) {
  if (!target.configDir) {
    return (
      'No shellui.config.json found in this folder or parents (stopped at .git). ' +
      'Run from a shellui project, or pass --config <path>.'
    );
  }
  if (!target.hostingUrl) {
    return (
      `Missing hosting.url in config at ${target.configDir}. ` +
      'Add hosting.url to shellui.config.json (or shellui.hosting.config.json).'
    );
  }
  try {
    const u = new URL(target.hostingUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `Invalid hosting URL: ${target.hostingUrl}`;
    }
  } catch {
    return `Invalid hosting URL: ${target.hostingUrl}`;
  }
  if (options.requireSlug && !target.slug) {
    return (
      `Missing preview slug. Set hosting.slug in config at ${target.configDir} ` +
      'or pass --slug <slug>.'
    );
  }
  return null;
}

/**
 * Warn about deprecated hosting.app when present in config (ignored for preview deploy).
 * @param {string} [startDir]
 * @param {{ config?: string }} [options]
 * @returns {string | null}
 */
export function deprecatedHostingAppWarning(startDir = '.', options = {}) {
  const { hosting, configDir } = peekHostingFromConfig(startDir, options);
  if (!hosting || typeof hosting.app !== 'string' || !hosting.app.trim()) return null;
  return (
    `Warning: hosting.app is deprecated and ignored for preview deploys` +
    (configDir ? ` (${configDir})` : '') +
    '. Use hosting.slug to redeploy an existing preview site, or omit it to create a new one.'
  );
}
