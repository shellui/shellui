/**
 * Environment variable substitution in Shellui config string values.
 *
 * Supports:
 * - `${VAR}` — replaced with process.env.VAR (empty string if unset)
 * - `${VAR:-default}` — use default when VAR is unset or empty
 *
 * When a string value is exactly one substitution (no surrounding text), the
 * result is coerced to number / boolean / null when it looks like a JSON literal
 * so `"port": "${PORT:-4000}"` becomes number 4000.
 *
 * Substitution runs only in the CLI at load/build time. The frontend receives a
 * frozen snapshot with values already resolved — there is no runtime env override
 * in the browser.
 */

import fs from 'fs';
import path from 'path';

/** Matches `${NAME}` or `${NAME:-default}` (default may be empty). */
const ENV_TOKEN_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

/** Detect leftover placeholders that should not ship to the frontend. */
const LEFTOVER_ENV_RE = /\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}/g;

/**
 * Filename written into the production dist output (resolved snapshot).
 */
export const GENERATED_FRONTEND_CONFIG_FILE = 'shellui.config.json';

/**
 * @param {string} raw
 * @returns {string | number | boolean | null}
 */
function coerceWholeValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === '') return '';
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

/**
 * Resolve a single env reference.
 * @param {string} name
 * @param {string | undefined} defaultValue - present when `:-` was used (may be '')
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} missing
 * @returns {string}
 */
function resolveEnvVar(name, defaultValue, env, missing) {
  const value = env[name];
  if (value != null && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  missing.push(name);
  return '';
}

/**
 * Substitute env placeholders in a single string.
 * @param {string} input
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} missing
 * @returns {string | number | boolean | null}
 */
export function substituteEnvInString(input, env = process.env, missing = []) {
  if (typeof input !== 'string' || !input.includes('${')) {
    return input;
  }

  const trimmed = input.trim();
  const wholeMatch = /^\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}$/.exec(trimmed);
  if (wholeMatch && trimmed === input) {
    const resolved = resolveEnvVar(wholeMatch[1], wholeMatch[2], env, missing);
    return coerceWholeValue(resolved);
  }

  return input.replace(ENV_TOKEN_RE, (_match, name, defaultValue) =>
    resolveEnvVar(name, defaultValue, env, missing),
  );
}

/**
 * Recursively substitute env placeholders in all string values.
 * @param {unknown} value
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ value: unknown, missing: string[] }}
 */
export function substituteEnvInConfig(value, env = process.env) {
  /** @type {string[]} */
  const missing = [];

  function walk(node) {
    if (typeof node === 'string') {
      return substituteEnvInString(node, env, missing);
    }
    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }
    if (node && typeof node === 'object') {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const [key, child] of Object.entries(node)) {
        out[key] = walk(child);
      }
      return out;
    }
    return node;
  }

  return { value: walk(value), missing: [...new Set(missing)] };
}

/**
 * Build a frozen, JSON-serializable config snapshot for the frontend.
 * Env placeholders must already have been substituted by loadConfig.
 * Strips CLI-only fields and fails if unresolved `${VAR}` tokens remain.
 *
 * @param {Object} config - Loaded config (after env substitution + Sentry merge)
 * @returns {Record<string, unknown>}
 */
export function prepareFrontendConfig(config) {
  let frozen;
  try {
    frozen = JSON.parse(JSON.stringify(config ?? {}));
  } catch (e) {
    const err = new Error(
      `Config cannot be serialized for the frontend: ${e.message}. ` +
        `Remove non-JSON values (functions, circular refs) from the configuration.`,
    );
    err.code = 'CONFIG_NOT_SERIALIZABLE';
    throw err;
  }

  if (frozen && typeof frozen === 'object' && !Array.isArray(frozen)) {
    delete frozen.runtime;
    delete frozen.$schema;
  }

  const serialized = JSON.stringify(frozen);
  const leftovers = serialized.match(LEFTOVER_ENV_RE);
  if (leftovers?.length) {
    const unique = [...new Set(leftovers)];
    const err = new Error(
      `Unresolved environment placeholder(s) in config that would be shipped to the frontend: ${unique.join(', ')}. ` +
        `Env substitution runs only in the CLI at load/build time. Fix the placeholders or provide env values / defaults before building.`,
    );
    err.code = 'CONFIG_UNRESOLVED_ENV';
    err.placeholders = unique;
    throw err;
  }

  return frozen;
}

/**
 * Write the resolved frontend config into the build output directory.
 * @param {string} outDir - Absolute path to dist (e.g. dist/web)
 * @param {Object} config - Loaded config
 * @returns {{ filePath: string, config: Record<string, unknown> }}
 */
export function writeGeneratedFrontendConfig(outDir, config) {
  const frontendConfig = prepareFrontendConfig(config);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const filePath = path.join(outDir, GENERATED_FRONTEND_CONFIG_FILE);
  fs.writeFileSync(filePath, `${JSON.stringify(frontendConfig, null, 2)}\n`, 'utf8');
  return { filePath, config: frontendConfig };
}
