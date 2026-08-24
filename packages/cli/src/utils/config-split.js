import fs from 'fs';
import path from 'path';
import {
  MAIN_CONFIG_FILE,
  ROOT_KEYS,
  SECTION_KEYS,
  ROOT_SPLIT_NAME,
  isRootConfigKey,
  isSectionConfigKey,
  listSplitConfigFiles,
  splitConfigFileName,
  stringifyConfigJson,
  stripSchemaKey,
} from './config-paths.js';
import { validateConfig } from './config-validate.js';

/**
 * Read and parse a JSON config file.
 * @param {string} filePath
 * @returns {Record<string, unknown>}
 */
export function readJsonConfigFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    const err = new Error(`Failed to read config file ${filePath}: ${e.message}`);
    err.code = 'CONFIG_READ';
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const err = new Error(`Config file ${filePath} must be a JSON object.`);
      err.code = 'CONFIG_PARSE';
      throw err;
    }
    return parsed;
  } catch (e) {
    if (e.code === 'CONFIG_PARSE') throw e;
    const err = new Error(`Failed to parse JSON in ${filePath}: ${e.message}`);
    err.code = 'CONFIG_PARSE';
    throw err;
  }
}

/**
 * Validate that a split file only contains allowed keys for its name.
 * @param {string} splitName
 * @param {Record<string, unknown>} data
 * @param {string} filePath
 */
function assertSplitFileKeys(splitName, data, filePath) {
  const keys = Object.keys(stripSchemaKey(data));
  if (splitName === ROOT_SPLIT_NAME) {
    const invalid = keys.filter((k) => !isRootConfigKey(k));
    if (invalid.length) {
      const err = new Error(
        `${path.basename(filePath)} may only contain root keys (${ROOT_KEYS.join(', ')}). ` +
          `Found unexpected key(s): ${invalid.join(', ')}. ` +
          `Move section keys into shellui.<section>.config.json files.`,
      );
      err.code = 'CONFIG_SPLIT_KEYS';
      throw err;
    }
    return;
  }

  if (!isSectionConfigKey(splitName)) {
    const err = new Error(
      `Unknown split config section "${splitName}" in ${path.basename(filePath)}. ` +
        `Expected one of: ${ROOT_SPLIT_NAME}, ${SECTION_KEYS.join(', ')}.`,
    );
    err.code = 'CONFIG_SPLIT_NAME';
    throw err;
  }

  const unexpected = keys.filter((k) => k !== splitName);
  if (keys.length === 0) {
    const err = new Error(
      `${path.basename(filePath)} is empty. It must contain the "${splitName}" key.`,
    );
    err.code = 'CONFIG_SPLIT_KEYS';
    throw err;
  }
  if (!keys.includes(splitName) || unexpected.length) {
    const err = new Error(
      `${path.basename(filePath)} must contain only the "${splitName}" key. ` +
        `Found: ${keys.join(', ') || '(none)'}.`,
    );
    err.code = 'CONFIG_SPLIT_KEYS';
    throw err;
  }
}

/**
 * Merge split config files into one object. Rejects duplicate top-level keys.
 * @param {{ name: string, path: string }[]} splitFiles
 * @returns {Record<string, unknown>}
 */
export function mergeSplitConfigs(splitFiles) {
  /** @type {Record<string, unknown>} */
  const merged = {};
  /** @type {Record<string, string>} */
  const keySources = {};

  for (const file of splitFiles) {
    const data = readJsonConfigFile(file.path);
    assertSplitFileKeys(file.name, data, file.path);
    const partial = stripSchemaKey(data);

    for (const [key, value] of Object.entries(partial)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        const err = new Error(
          `Duplicate config key "${key}" in ${path.basename(file.path)} ` +
            `(already defined in ${keySources[key]}). ` +
            `Each top-level key may appear in only one split file.`,
        );
        err.code = 'CONFIG_DUPLICATE_KEY';
        throw err;
      }
      merged[key] = value;
      keySources[key] = path.basename(file.path);
    }
  }

  return merged;
}

/**
 * Split a single config object into root + section files.
 * @param {Record<string, unknown>} config - Without needing $schema
 * @param {string} configDir
 * @returns {string[]} Written file paths
 */
export function writeSplitConfigFiles(config, configDir) {
  const clean = stripSchemaKey(config);
  const written = [];

  const rootPartial = {};
  for (const key of ROOT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(clean, key)) {
      rootPartial[key] = clean[key];
    }
  }
  if (Object.keys(rootPartial).length > 0) {
    const filePath = path.join(configDir, splitConfigFileName(ROOT_SPLIT_NAME));
    fs.writeFileSync(filePath, stringifyConfigJson(rootPartial), 'utf8');
    written.push(filePath);
  }

  for (const section of SECTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(clean, section)) continue;
    const partial = { [section]: clean[section] };
    const filePath = path.join(configDir, splitConfigFileName(section));
    fs.writeFileSync(filePath, stringifyConfigJson(partial), 'utf8');
    written.push(filePath);
  }

  const unknown = Object.keys(clean).filter((k) => !isRootConfigKey(k) && !isSectionConfigKey(k));
  if (unknown.length) {
    const err = new Error(
      `Cannot split unknown top-level key(s): ${unknown.join(', ')}. ` +
        `Known root keys: ${ROOT_KEYS.join(', ')}. Known sections: ${SECTION_KEYS.join(', ')}.`,
    );
    err.code = 'CONFIG_SPLIT_UNKNOWN';
    throw err;
  }

  return written;
}

/**
 * Split shellui.config.json into focused files.
 * @param {string} configDir
 * @returns {{ written: string[], removed: string }}
 */
export function splitConfig(configDir) {
  const mainPath = path.join(configDir, MAIN_CONFIG_FILE);
  if (!fs.existsSync(mainPath)) {
    const err = new Error(
      `No ${MAIN_CONFIG_FILE} found in ${configDir}. ` +
        `Split requires a single ${MAIN_CONFIG_FILE}. ` +
        `If you already use split files, there is nothing to do.`,
    );
    err.code = 'CONFIG_SPLIT_NO_MAIN';
    throw err;
  }

  const existingSplit = listSplitConfigFiles(configDir);
  if (existingSplit.length) {
    const err = new Error(
      `Split config files already exist alongside ${MAIN_CONFIG_FILE}. ` +
        `Remove them or run ${'`shellui config unsplit`'} first.`,
    );
    err.code = 'CONFIG_MODE_CONFLICT';
    throw err;
  }

  const config = readJsonConfigFile(mainPath);
  validateConfig(config, { source: MAIN_CONFIG_FILE });
  const written = writeSplitConfigFiles(config, configDir);
  fs.unlinkSync(mainPath);
  return { written, removed: mainPath };
}

/**
 * Merge split files back into shellui.config.json.
 * @param {string} configDir
 * @returns {{ written: string, removed: string[] }}
 */
export function unsplitConfig(configDir) {
  const mainPath = path.join(configDir, MAIN_CONFIG_FILE);
  if (fs.existsSync(mainPath)) {
    const err = new Error(
      `${MAIN_CONFIG_FILE} already exists in ${configDir}. ` +
        `Unsplit merges split files into ${MAIN_CONFIG_FILE}; remove the main file first or delete split files.`,
    );
    err.code = 'CONFIG_UNSPLIT_HAS_MAIN';
    throw err;
  }

  const splitFiles = listSplitConfigFiles(configDir);
  if (!splitFiles.length) {
    const err = new Error(
      `No split config files (shellui.<name>.config.json) found in ${configDir}. ` +
        `Nothing to unsplit.`,
    );
    err.code = 'CONFIG_UNSPLIT_NONE';
    throw err;
  }

  const merged = mergeSplitConfigs(splitFiles);
  validateConfig(merged, { source: 'merged split configs' });
  fs.writeFileSync(mainPath, stringifyConfigJson(merged), 'utf8');

  const removed = [];
  for (const file of splitFiles) {
    fs.unlinkSync(file.path);
    removed.push(file.path);
  }

  return { written: mainPath, removed };
}
