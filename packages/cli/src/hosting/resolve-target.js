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
 *   app?: string,
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

  const appFromConfig =
    typeof fromConfig?.app === 'string' && fromConfig.app.trim() ? fromConfig.app.trim() : '';
  const appOverride =
    typeof options.app === 'string' && options.app.trim() ? options.app.trim() : '';

  return {
    hostingUrl: hostingUrlRaw.replace(/\/$/, ''),
    slug: slugOverride || slugFromConfig,
    app: appOverride || appFromConfig,
    configDir,
  };
}

/**
 * @param {{
 *   hostingUrl: string,
 *   slug?: string,
 *   app?: string,
 *   configDir?: string | null,
 * }} target
 * @param {{ requireSlug?: boolean, requireApp?: boolean }} [options]
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
  if (options.requireApp && !target.app) {
    return (
      `Missing production app. Set hosting.app in config at ${target.configDir} ` +
      'to the app name from admin (Hosting), or pass --app <name>.'
    );
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
 * Note for preview deploys when hosting.app is set: it names the production app
 * and is only used by --prod, promote, and history or rollback with --prod.
 * @param {string} [startDir]
 * @param {{ config?: string }} [options]
 * @returns {string | null}
 */
export function hostingAppPreviewNote(startDir = '.', options = {}) {
  const { hosting } = peekHostingFromConfig(startDir, options);
  if (!hosting || typeof hosting.app !== 'string' || !hosting.app.trim()) return null;
  return (
    `Note: hosting.app ("${hosting.app.trim()}") is your production app. ` +
    'This is a preview deploy. Pass --prod to deploy to production.'
  );
}
