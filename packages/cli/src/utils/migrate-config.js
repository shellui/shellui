import fs from 'fs';
import path from 'path';
import {
  MAIN_CONFIG_FILE,
  TS_CONFIG_BACKUP_FILE,
  TS_CONFIG_FILE,
  stringifyConfigJson,
} from './config-paths.js';
import { loadTypeScriptConfig } from './config-loaders.js';
import { validateConfig } from './config-validate.js';

/**
 * Ensure a value is a plain JSON-serializable object (no functions, undefined holes, etc.).
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toPlainConfigObject(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (e) {
    const err = new Error(
      `Migrated config is not JSON-serializable: ${e.message}. ` +
        `Remove functions, circular references, or other non-JSON values from the TypeScript export.`,
    );
    err.code = 'MIGRATE_NOT_SERIALIZABLE';
    throw err;
  }

  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error(
      'TypeScript config must export a plain object. Got ' +
        (parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed) +
        '.',
    );
    err.code = 'MIGRATE_NOT_OBJECT';
    throw err;
  }
  return parsed;
}

/**
 * Migrate shellui.config.ts → shellui.config.json by evaluating the TypeScript
 * module and writing the resulting initialized object as JSON.
 * @param {string} configDir
 * @returns {Promise<{ jsonPath: string, backupPath: string }>}
 */
export async function migrateTsConfig(configDir) {
  const tsPath = path.join(configDir, TS_CONFIG_FILE);
  const jsonPath = path.join(configDir, MAIN_CONFIG_FILE);
  const backupPath = path.join(configDir, TS_CONFIG_BACKUP_FILE);

  if (!fs.existsSync(tsPath)) {
    const err = new Error(
      `No ${TS_CONFIG_FILE} found in ${configDir}. ` +
        `There is nothing to migrate. If you already use ${MAIN_CONFIG_FILE}, you are done. ` +
        `Otherwise run ${'`shellui init`'} to create a JSON config.`,
    );
    err.code = 'MIGRATE_NO_TS';
    throw err;
  }

  if (fs.existsSync(jsonPath)) {
    const err = new Error(
      `${MAIN_CONFIG_FILE} already exists in ${configDir}. ` +
        `Remove or rename it before running migrate, or keep the JSON file and delete ${TS_CONFIG_FILE} if migration is complete.`,
    );
    err.code = 'MIGRATE_JSON_EXISTS';
    throw err;
  }

  let loaded;
  try {
    loaded = await loadTypeScriptConfig(tsPath, configDir);
  } catch (e) {
    const err = new Error(
      `Failed to evaluate ${TS_CONFIG_FILE}: ${e.message}\n` +
        `Fix the TypeScript config so it loads successfully, then retry ${'`shellui config migrate`'}.`,
    );
    err.code = 'MIGRATE_LOAD_FAILED';
    err.cause = e;
    throw err;
  }

  const config = toPlainConfigObject(loaded);
  validateConfig(config, { source: TS_CONFIG_FILE });

  fs.writeFileSync(jsonPath, stringifyConfigJson(config), 'utf8');
  fs.renameSync(tsPath, backupPath);

  return { jsonPath, backupPath };
}
