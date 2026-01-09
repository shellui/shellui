import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadTypeScriptConfig, loadJsonConfig } from './config-loaders.js';

/**
 * Load configuration from shellui.config.ts or shellui.config.json file
 * Prefers TypeScript config over JSON config
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

  return config;
}

