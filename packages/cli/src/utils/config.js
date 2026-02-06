import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadTypeScriptConfig, loadJsonConfig } from './config-loaders.js';

/**
 * Merge Sentry config from env into the loaded config. Only adds sentry when
 * SENTRY_DSN is set and Sentry is not disabled via SENTRY_ENABLED=false|0.
 * @param {Object} config - Loaded config object
 * @returns {Object} Config with sentry merged from env when enabled
 */
function mergeSentryFromEnv(config) {
  const dsn = process.env.SENTRY_DSN;
  const enabled = process.env.SENTRY_ENABLED;
  if (!dsn || enabled === 'false' || enabled === '0') {
    return config;
  }
  return {
    ...config,
    sentry: {
      dsn,
      ...(process.env.SENTRY_ENVIRONMENT && { environment: process.env.SENTRY_ENVIRONMENT }),
      ...(process.env.SENTRY_RELEASE && { release: process.env.SENTRY_RELEASE }),
    },
  };
}

/**
 * Load configuration from shellui.config.ts or shellui.config.json file
 * Prefers TypeScript config over JSON config. Sentry is merged from env on load
 * (SENTRY_DSN, SENTRY_ENABLED, SENTRY_ENVIRONMENT, SENTRY_RELEASE).
 * @param {string} root - Root directory to search for config (default: current working directory)
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);
  const tsConfigPath = path.join(configDir, 'shellui.config.ts');
  const jsonConfigPath = path.join(configDir, 'shellui.config.json');

  let config = {};
  let activeConfigPath = null;

  // Prefer TypeScript config over JSON
  if (fs.existsSync(tsConfigPath)) {
    activeConfigPath = tsConfigPath;
  } else if (fs.existsSync(jsonConfigPath)) {
    activeConfigPath = jsonConfigPath;
  }

  if (activeConfigPath) {
    try {
      if (activeConfigPath === tsConfigPath) {
        config = await loadTypeScriptConfig(activeConfigPath, configDir);
      } else {
        config = loadJsonConfig(activeConfigPath);
      }
    } catch (e) {
      console.error(pc.red(`Failed to load config from ${activeConfigPath}: ${e.message}`));
      if (e.stack) {
        console.error(pc.red(e.stack));
      }
    }
  } else {
    console.log(pc.yellow(`No shellui.config.ts or shellui.config.json found, using defaults.`));
  }

  return mergeSentryFromEnv(config);
}
