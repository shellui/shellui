import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/** Default embedded companion path for production builds (matches template `.env.example`). */
export const DEFAULT_PRODUCTION_APP_URL = '/app';

/**
 * Load project `.env` files from the consumer project root (not Vite's envDir).
 * Called before config env substitution so `${SHELLUI_APP_URL:-…}` resolves correctly.
 *
 * @param {string} projectRoot - Absolute path to the Shellui project root
 * @param {{ override?: boolean }} [opts]
 */
export function loadProjectEnvFiles(projectRoot, opts = {}) {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: opts.override === true });
  }

  const localPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath, override: true });
  }
}

/**
 * Apply production build defaults after `.env` is loaded.
 * Keeps dev/start behavior (companion dev URL fallback) while ensuring
 * `shellui build` embeds the local companion at `/app` out of the box.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function applyProductionBuildEnvDefaults(env = process.env) {
  if (env.SHELLUI_APP_URL == null || env.SHELLUI_APP_URL === '') {
    env.SHELLUI_APP_URL = DEFAULT_PRODUCTION_APP_URL;
  }
}

/**
 * Load project env and apply build-time defaults before `loadConfig`.
 * @param {string} projectRoot
 */
export function prepareBuildEnvironment(projectRoot) {
  loadProjectEnvFiles(projectRoot);
  applyProductionBuildEnvDefaults();
}
