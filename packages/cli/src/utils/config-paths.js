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
  'activeTheme',
  'theme',
  'themesDir',
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
 * @param {{ mainPath?: string, tsPath?: string }} [overrides]
 * @returns {{ mode: 'main' | 'split' | 'ts' | 'none', mainPath?: string, tsPath?: string, splitFiles?: ReturnType<typeof listSplitConfigFiles> }}
 */
export function discoverConfigMode(configDir, overrides = {}) {
  const mainPath = overrides.mainPath || path.join(configDir, MAIN_CONFIG_FILE);
  const tsPath = overrides.tsPath || path.join(configDir, TS_CONFIG_FILE);
  const splitFiles = listSplitConfigFiles(configDir);
  const hasMain = fs.existsSync(mainPath);
  const hasSplit = splitFiles.length > 0;
  const hasTs = fs.existsSync(tsPath);

  if (hasMain && hasSplit) {
    const err = new Error(
      `Both ${path.basename(mainPath)} and split config files exist in ${configDir}. ` +
        `Use either a single JSON config or split files (shellui.<name>.config.json), not both. ` +
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

/**
 * Whether this directory has a shellui config (main JSON, split, or TS).
 * @param {string} configDir
 * @returns {boolean}
 */
export function directoryHasShelluiConfig(configDir) {
  try {
    return discoverConfigMode(configDir).mode !== 'none';
  } catch {
    // Conflict (main + split) still means config lives here
    return true;
  }
}

/**
 * Walk from startDir upward looking for shellui config.
 * Stops at the first directory that contains a `.git` entry (file or directory)
 * after checking that directory, or at the filesystem root.
 *
 * @param {string} [startDir]
 * @returns {string | null} Absolute config directory, or null if none found
 */
export function findProjectConfigDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);

  while (true) {
    if (directoryHasShelluiConfig(dir)) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return null;
    }
    if (dir === root) {
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Resolve where Shellui config files live.
 *
 * `--config` / `SHELLUI_CONFIG` may be:
 * - a directory containing `shellui.config.json` / split files / `shellui.config.ts`
 * - a path to a `.json` or `.ts` config file (parent dir is the config directory)
 *
 * Project `root` stays the app root (static/, dist/, …). Config location is independent.
 *
 * @param {string} [root='.'] - Project root (relative to cwd)
 * @param {string} [configPath] - From `--config` or env (relative to cwd, or absolute)
 * @returns {{
 *   projectRoot: string,
 *   configDir: string,
 *   mainPath: string,
 *   tsPath: string,
 *   explicitMainJson: boolean,
 *   explicitTs: boolean,
 * }}
 */
export function resolveConfigLocation(root = '.', configPath) {
  const cwd = process.cwd();
  const projectRoot = path.resolve(cwd, root ?? '.');
  const raw =
    configPath != null && String(configPath).trim() !== '' ? String(configPath).trim() : null;

  if (!raw) {
    return {
      projectRoot,
      configDir: projectRoot,
      mainPath: path.join(projectRoot, MAIN_CONFIG_FILE),
      tsPath: path.join(projectRoot, TS_CONFIG_FILE),
      explicitMainJson: false,
      explicitTs: false,
    };
  }

  let resolved = path.resolve(cwd, raw);
  if (!fs.existsSync(resolved) && !path.isAbsolute(raw)) {
    const fromRoot = path.resolve(projectRoot, raw);
    if (fs.existsSync(fromRoot) || looksLikeConfigFile(raw)) {
      resolved = fromRoot;
    }
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return {
      projectRoot,
      configDir: resolved,
      mainPath: path.join(resolved, MAIN_CONFIG_FILE),
      tsPath: path.join(resolved, TS_CONFIG_FILE),
      explicitMainJson: false,
      explicitTs: false,
    };
  }

  if (looksLikeConfigFile(resolved) || looksLikeConfigFile(raw)) {
    const configDir = path.dirname(resolved);
    const base = path.basename(resolved).toLowerCase();
    const isTs = base.endsWith('.ts');
    return {
      projectRoot,
      configDir,
      mainPath: isTs ? path.join(configDir, MAIN_CONFIG_FILE) : resolved,
      tsPath: isTs ? resolved : path.join(configDir, TS_CONFIG_FILE),
      explicitMainJson: !isTs,
      explicitTs: isTs,
    };
  }

  // Path does not exist yet and does not look like a file — treat as config directory (e.g. init).
  return {
    projectRoot,
    configDir: resolved,
    mainPath: path.join(resolved, MAIN_CONFIG_FILE),
    tsPath: path.join(resolved, TS_CONFIG_FILE),
    explicitMainJson: false,
    explicitTs: false,
  };
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function looksLikeConfigFile(p) {
  const base = path.basename(p).toLowerCase();
  return base.endsWith('.json') || base.endsWith('.ts') || base.endsWith('.ts.bak');
}

/**
 * Pick config path from CLI options or SHELLUI_CONFIG env.
 * @param {{ config?: string }} [options]
 * @returns {string | undefined}
 */
export function getConfigPathOption(options = {}) {
  if (options?.config != null && String(options.config).trim() !== '') {
    return String(options.config).trim();
  }
  if (process.env.SHELLUI_CONFIG != null && String(process.env.SHELLUI_CONFIG).trim() !== '') {
    return String(process.env.SHELLUI_CONFIG).trim();
  }
  return undefined;
}
