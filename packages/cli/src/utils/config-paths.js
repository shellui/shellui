import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

/** Main single-file JSON config name. */
export const MAIN_CONFIG_FILE = 'shellui.config.json';

/** Advanced TypeScript config name. */
export const TS_CONFIG_FILE = 'shellui.config.ts';

/** Backup name after migrate. */
export const TS_CONFIG_BACKUP_FILE = 'shellui.config.ts.bak';

/** Split file for scalar/root keys. */
export const ROOT_SPLIT_NAME = 'root';

/**
 * Top-level keys that go into shellui.root.config.json when splitting.
 */
export const ROOT_KEYS = [
  'port',
  'title',
  'version',
  'favicon',
  'appIcon',
  'logo',
  'language',
  'layout',
  'start_url',
  'defaultTheme',
];

/**
 * Top-level section keys → shellui.<section>.config.json
 */
export const SECTION_KEYS = [
  'navigation',
  'administration',
  'storage',
  'backend',
  'themes',
  'cookieConsent',
  'legalDocuments',
  'sentry',
];

const ROOT_KEY_SET = new Set(ROOT_KEYS);
const SECTION_KEY_SET = new Set(SECTION_KEYS);

/** Relative $schema path written into generated JSON configs. */
export const CONFIG_SCHEMA_REF = './node_modules/@shellui/core/schemas/shellui.config.schema.json';

const SPLIT_FILE_RE = /^shellui\.(.+)\.config\.json$/;

/**
 * @param {string} name - Split section name (e.g. "storage", "root")
 * @returns {string}
 */
export function splitConfigFileName(name) {
  return `shellui.${name}.config.json`;
}

/**
 * @param {string} fileName - Basename only
 * @returns {string | null} Split name or null if not a split file
 */
export function parseSplitConfigFileName(fileName) {
  if (fileName === MAIN_CONFIG_FILE) return null;
  const match = fileName.match(SPLIT_FILE_RE);
  return match ? match[1] : null;
}

/**
 * List split config files in a directory.
 * @param {string} configDir
 * @returns {{ fileName: string, name: string, path: string }[]}
 */
export function listSplitConfigFiles(configDir) {
  if (!fs.existsSync(configDir)) return [];
  return fs
    .readdirSync(configDir)
    .map((fileName) => {
      const name = parseSplitConfigFileName(fileName);
      if (!name) return null;
      return { fileName, name, path: path.join(configDir, fileName) };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} configDir
 * @returns {{ mode: 'main' | 'split' | 'ts' | 'none', mainPath?: string, tsPath?: string, splitFiles?: ReturnType<typeof listSplitConfigFiles> }}
 */
export function discoverConfigMode(configDir) {
  const mainPath = path.join(configDir, MAIN_CONFIG_FILE);
  const tsPath = path.join(configDir, TS_CONFIG_FILE);
  const splitFiles = listSplitConfigFiles(configDir);
  const hasMain = fs.existsSync(mainPath);
  const hasSplit = splitFiles.length > 0;
  const hasTs = fs.existsSync(tsPath);

  if (hasMain && hasSplit) {
    const err = new Error(
      `Both ${MAIN_CONFIG_FILE} and split config files exist in ${configDir}. ` +
        `Use either a single ${MAIN_CONFIG_FILE} or split files (shellui.<name>.config.json), not both. ` +
        `Run ${'`shellui config unsplit`'} to merge, or remove the split files.`,
    );
    err.code = 'CONFIG_MODE_CONFLICT';
    throw err;
  }

  if (hasMain) {
    return { mode: 'main', mainPath, splitFiles: [] };
  }
  if (hasSplit) {
    return { mode: 'split', splitFiles };
  }
  if (hasTs) {
    return { mode: 'ts', tsPath, splitFiles: [] };
  }
  return { mode: 'none', splitFiles: [] };
}

/**
 * Whether a top-level key belongs in the root split file.
 * @param {string} key
 */
export function isRootConfigKey(key) {
  return ROOT_KEY_SET.has(key);
}

/**
 * Whether a top-level key is a known section split.
 * @param {string} key
 */
export function isSectionConfigKey(key) {
  return SECTION_KEY_SET.has(key);
}

/**
 * Resolve absolute path to the packaged JSON schema.
 * @returns {string}
 */
export function resolveConfigSchemaPath() {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('@shellui/core/schemas/shellui.config.schema.json');
  } catch {
    // Workspace / monorepo fallback
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidate = path.resolve(here, '../../../core/schemas/shellui.config.schema.json');
    if (fs.existsSync(candidate)) return candidate;
    throw new Error(
      'Could not resolve Shellui config JSON schema. Ensure @shellui/core is installed and schemas are generated.',
    );
  }
}

/**
 * Strip $schema and return a shallow copy for runtime use.
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
export function stripSchemaKey(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }
  const { $schema: _schema, ...rest } = config;
  return rest;
}

/**
 * Pretty-print JSON config with $schema first.
 * @param {Record<string, unknown>} config
 * @returns {string}
 */
export function stringifyConfigJson(config) {
  const withSchema = {
    $schema: CONFIG_SCHEMA_REF,
    ...stripSchemaKey(config),
  };
  return `${JSON.stringify(withSchema, null, 2)}\n`;
}
