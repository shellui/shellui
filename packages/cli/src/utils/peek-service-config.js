import path from 'path';
import { substituteEnvInConfig } from './config-env.js';
import {
  discoverConfigMode,
  findProjectConfigDir,
  getConfigPathOption,
  resolveConfigLocation,
  stripSchemaKey,
} from './config-paths.js';
import { mergeSplitConfigs, readJsonConfigFile } from './config-split.js';

/**
 * @param {string} configDir
 * @returns {{
 *   saas?: { url?: string },
 *   storage?: { url?: string },
 *   hosting?: { url?: string, slug?: string },
 * } | null}
 */
export function peekServiceUrlsFromDir(configDir) {
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
    const saas =
      value?.saas && typeof value.saas === 'object'
        ? /** @type {{ url?: string }} */ (value.saas)
        : undefined;
    const storage =
      value?.storage && typeof value.storage === 'object'
        ? /** @type {{ url?: string }} */ (value.storage)
        : undefined;
    const hosting =
      value?.hosting && typeof value.hosting === 'object'
        ? /** @type {{ url?: string, slug?: string }} */ (value.hosting)
        : undefined;
    return { saas, storage, hosting };
  } catch {
    return null;
  }
}

/**
 * @param {string} [startDir]
 * @param {{ config?: string }} [options]
 */
export function peekServiceUrlsFromConfig(startDir = '.', options = {}) {
  const explicit = getConfigPathOption(options);
  if (explicit) {
    try {
      const location = resolveConfigLocation(startDir, explicit);
      const peeked = peekServiceUrlsFromDir(location.configDir);
      return {
        ...peeked,
        configDir: location.configDir,
      };
    } catch {
      return { saas: undefined, storage: undefined, hosting: undefined, configDir: null };
    }
  }
  const found = findProjectConfigDir(path.resolve(startDir));
  if (!found) {
    return { saas: undefined, storage: undefined, hosting: undefined, configDir: null };
  }
  const peeked = peekServiceUrlsFromDir(found);
  return {
    saas: peeked?.saas,
    storage: peeked?.storage,
    hosting: peeked?.hosting,
    configDir: found,
  };
}
