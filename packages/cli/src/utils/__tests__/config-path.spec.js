import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { resolveConfigLocation } from '../config-paths.js';
import { loadConfig } from '../config.js';
import { MAIN_CONFIG_FILE } from '../config-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = path.join(__dirname, 'test-fixtures-config-path');
const originalCwd = process.cwd();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('resolveConfigLocation', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('defaults to project root', () => {
    const loc = resolveConfigLocation('.');
    expect(loc.configDir).toBe(path.resolve(testDir));
    expect(loc.mainPath).toBe(path.join(testDir, MAIN_CONFIG_FILE));
  });

  test('accepts a config directory', () => {
    const configDir = path.join(testDir, 'config');
    fs.mkdirSync(configDir);
    const loc = resolveConfigLocation('.', './config');
    expect(loc.projectRoot).toBe(path.resolve(testDir));
    expect(loc.configDir).toBe(configDir);
    expect(loc.mainPath).toBe(path.join(configDir, MAIN_CONFIG_FILE));
  });

  test('accepts a config file path', () => {
    const configDir = path.join(testDir, 'config');
    fs.mkdirSync(configDir);
    const file = path.join(configDir, 'shellui.config.json');
    fs.writeFileSync(file, '{}');
    const loc = resolveConfigLocation('.', './config/shellui.config.json');
    expect(loc.configDir).toBe(configDir);
    expect(loc.mainPath).toBe(file);
    expect(loc.explicitMainJson).toBe(true);
  });
});

describe('loadConfig with --config path', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('loads JSON from a subdirectory', async () => {
    const configDir = path.join(testDir, 'config');
    fs.mkdirSync(configDir);
    fs.writeFileSync(
      path.join(configDir, MAIN_CONFIG_FILE),
      JSON.stringify({ title: 'FromConfigDir', port: 4123 }),
    );

    const config = await loadConfig('.', { config: './config' });
    expect(config).toEqual({ title: 'FromConfigDir', port: 4123 });
  });

  test('loads an explicit JSON file path', async () => {
    const configDir = path.join(testDir, 'cfg');
    fs.mkdirSync(configDir);
    const file = path.join(configDir, 'app.config.json');
    fs.writeFileSync(file, JSON.stringify({ title: 'CustomName' }));

    const config = await loadConfig('.', { config: file });
    expect(config).toEqual({ title: 'CustomName' });
  });
});
