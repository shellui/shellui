import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig } from '../config.js';
import { MAIN_CONFIG_FILE, splitConfigFileName } from '../config-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testDir = path.join(__dirname, 'test-fixtures-config');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalCwd = process.cwd();

describe('loadConfig', () => {
  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
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
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should load JSON config when present', async () => {
    const jsonConfig = { title: 'json-config', version: '1.0.0' };
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ $schema: './schema.json', ...jsonConfig }));

    const config = await loadConfig('.');

    expect(config).toStrictEqual(jsonConfig);
  });

  test('should load and merge split config files', async () => {
    fs.writeFileSync(
      splitConfigFileName('root'),
      JSON.stringify({ title: 'split-app', port: 4000 }),
    );
    fs.writeFileSync(
      splitConfigFileName('storage'),
      JSON.stringify({ storage: { url: 'http://localhost:8001' } }),
    );

    const config = await loadConfig('.');

    expect(config).toStrictEqual({
      title: 'split-app',
      port: 4000,
      storage: { url: 'http://localhost:8001' },
    });
  });

  test('should reject when main JSON and split files both exist', async () => {
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ title: 'main' }));
    fs.writeFileSync(
      splitConfigFileName('storage'),
      JSON.stringify({ storage: { url: 'http://localhost:8001' } }),
    );

    await expect(loadConfig('.')).rejects.toThrow(/Both shellui\.config\.json and split/);
  });

  test('should reject invalid JSON config against schema', async () => {
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ title: 'x', unknownKey: true }));

    await expect(loadConfig('.')).rejects.toThrow(/Invalid Shellui configuration/);
  });

  test('should accept CLI-only dev companion', async () => {
    const jsonConfig = {
      title: 'with-dev',
      dev: { run: 'vite', url: 'http://localhost:5173', name: 'web' },
    };
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(jsonConfig));

    const config = await loadConfig('.');
    expect(config).toStrictEqual(jsonConfig);
  });

  test('should prefer JSON over TypeScript when both exist', async () => {
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ title: 'from-json' }));
    fs.writeFileSync(
      'shellui.config.ts',
      `export default ${JSON.stringify({ title: 'from-ts' })};`,
    );

    const config = await loadConfig('.');
    expect(config).toStrictEqual({ title: 'from-json' });
  });

  test('should load TypeScript config when no JSON is present', async () => {
    const tsConfig = { title: 'ts-config', version: '1.0.0' };
    fs.writeFileSync('shellui.config.ts', `export default ${JSON.stringify(tsConfig)};`);

    const config = await loadConfig('.');

    expect(config).toStrictEqual(tsConfig);
  });

  test('should return empty object when no config file exists', async () => {
    const config = await loadConfig('.');

    expect(config).toStrictEqual({});
  });

  test('should handle custom root directory with JSON', async () => {
    const subDir = path.join(testDir, 'subdir');
    fs.mkdirSync(subDir, { recursive: true });

    const jsonConfig = { title: 'subdir-config', version: '1.0.0' };
    fs.writeFileSync(path.join(subDir, MAIN_CONFIG_FILE), JSON.stringify(jsonConfig));

    const config = await loadConfig(subDir);

    expect(config).toStrictEqual(jsonConfig);
  });

  test('should handle TypeScript load errors gracefully and return empty object', async () => {
    fs.writeFileSync('shellui.config.ts', 'export const invalid = syntax error;');

    const config = await loadConfig('.');

    expect(config).toStrictEqual({});
  });

  test('should work with relative path', async () => {
    const jsonConfig = { title: 'relative-config', version: '1.0.0' };
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(jsonConfig));

    process.chdir(path.dirname(testDir));

    const config = await loadConfig(path.basename(testDir));

    expect(config).toStrictEqual(jsonConfig);
  });

  test('should substitute environment variables in JSON config', async () => {
    process.env.SHELLUI_TEST_BACKEND_URL = 'http://localhost:8000';
    fs.writeFileSync(
      MAIN_CONFIG_FILE,
      JSON.stringify({
        title: '${SHELLUI_TEST_TITLE:-EnvApp}',
        port: '${SHELLUI_TEST_PORT:-4000}',
        backend: {
          type: 'shellui',
          url: '${SHELLUI_TEST_BACKEND_URL}',
          companyId: '${SHELLUI_TEST_COMPANY_ID:-1}',
        },
      }),
    );

    try {
      const config = await loadConfig('.');
      expect(config).toEqual({
        title: 'EnvApp',
        port: 4000,
        backend: {
          type: 'shellui',
          url: 'http://localhost:8000',
          companyId: 1,
        },
      });
    } finally {
      delete process.env.SHELLUI_TEST_BACKEND_URL;
    }
  });
});
