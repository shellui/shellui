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

export const DEFAULT_BACKEND_URL = 'https://id.shellui.com';

/**
 * Quietly read config fields needed for CLI auth (no validation logs).
 * Supports main JSON and split configs (not TypeScript).
 * @param {string} configDir
 * @returns {{
 *   backend: {
 *     type?: string,
 *     url?: string,
 *     companyId?: string | number,
 *     loginUrl?: string,
 *     adminUrl?: string,
 *   } | null,
 * } | null}
 */
export function peekAuthConfigFromDir(configDir) {
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
    const backend =
      value?.backend && typeof value.backend === 'object'
        ? /** @type {{ type?: string, url?: string, companyId?: string | number, loginUrl?: string, adminUrl?: string }} */ (
            value.backend
          )
        : null;
    return { backend };
  } catch {
    return null;
  }
}

/**
 * @param {string} [startDir]
 * @param {{ config?: string }} [options]
 * @returns {{
 *   backend: {
 *     type?: string,
 *     url?: string,
 *     companyId?: string | number,
 *     loginUrl?: string,
 *     adminUrl?: string,
 *   } | null,
 *   configDir: string | null,
 * }}
 */
export function peekBackendFromConfig(startDir = '.', options = {}) {
  const explicit = getConfigPathOption(options);
  if (explicit) {
    try {
      const location = resolveConfigLocation(startDir, explicit);
      const peeked = peekAuthConfigFromDir(location.configDir);
      return {
        backend: peeked?.backend ?? null,
        configDir: location.configDir,
      };
    } catch {
      return { backend: null, configDir: null };
    }
  }

  const found = findProjectConfigDir(path.resolve(startDir));
  if (!found) {
    return { backend: null, configDir: null };
  }
  const peeked = peekAuthConfigFromDir(found);
  return {
    backend: peeked?.backend ?? null,
    configDir: found,
  };
}

/**
 * @param {{
 *   root?: string,
 *   config?: string,
 * }} [options]
 */
export function resolveAuthTarget(options = {}) {
  const startDir = path.resolve(options.root ?? '.');
  const { backend: fromConfig, configDir } = peekBackendFromConfig(startDir, {
    config: options.config,
  });

  const backendUrlRaw =
    (typeof fromConfig?.url === 'string' && fromConfig.url.trim()) || DEFAULT_BACKEND_URL;

  const companyIdRaw =
    fromConfig?.companyId != null && String(fromConfig.companyId).trim()
      ? String(fromConfig.companyId).trim()
      : '';

  const backendType =
    typeof fromConfig?.type === 'string' && fromConfig.type.trim()
      ? fromConfig.type.trim().toLowerCase()
      : null;

  return {
    backendUrl: backendUrlRaw.replace(/\/$/, ''),
    companyId: companyIdRaw,
    backendType,
    configDir,
  };
}

/**
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   backendType: string | null,
 *   configDir?: string | null,
 * }} target
 * @returns {string | null}
 */
export function validateAuthTarget(target) {
  if (!target.configDir) {
    return (
      'No shellui.config.json found in this folder or parents (stopped at .git). ' +
      'Run from a shellui project, or pass --config <path>.'
    );
  }
  if (target.backendType && target.backendType !== 'shellui') {
    return `CLI login requires backend.type "shellui" (got "${target.backendType}").`;
  }
  if (!target.companyId) {
    return (
      `Missing backend.companyId in config at ${target.configDir}. ` +
      'Add backend.companyId to shellui.config.json (or shellui.backend.config.json).'
    );
  }
  try {
    const u = new URL(target.backendUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `Invalid backend URL: ${target.backendUrl}`;
    }
  } catch {
    return `Invalid backend URL: ${target.backendUrl}`;
  }
  return null;
}
