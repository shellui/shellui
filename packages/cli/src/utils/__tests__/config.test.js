import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, 'test-fixtures-config');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalCwd = process.cwd();

describe('loadConfig', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Change to test directory
    process.chdir(testDir);
    // Suppress console output during tests
    console.log = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    // Restore console first
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    // Restore original working directory
    process.chdir(originalCwd);
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      try {
        fs.rmdirSync(testDir);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test('should prefer TypeScript config over JSON config', async () => {
    const tsConfig = { name: 'ts-config', version: '1.0.0' };
    const jsonConfig = { name: 'json-config', version: '2.0.0' };

    fs.writeFileSync('shellui.config.ts', `export default ${JSON.stringify(tsConfig)};`);
    fs.writeFileSync('shellui.config.json', JSON.stringify(jsonConfig, null, 2));

    const config = await loadConfig('.');

    expect(config).toStrictEqual(tsConfig);
  });

  test('should load JSON config when TypeScript config does not exist', async () => {
    const jsonConfig = { name: 'json-only', version: '1.0.0' };

    fs.writeFileSync('shellui.config.json', JSON.stringify(jsonConfig, null, 2));

    const config = await loadConfig('.');

    expect(config).toStrictEqual(jsonConfig);
  });

  test('should return empty object when no config files exist', async () => {
    const config = await loadConfig('.');

    expect(config).toStrictEqual({});
  });

  test('should handle custom root directory', async () => {
    const subDir = path.join(testDir, 'subdir');
    fs.mkdirSync(subDir, { recursive: true });

    const jsonConfig = { name: 'subdir-config', version: '1.0.0' };
    fs.writeFileSync(path.join(subDir, 'shellui.config.json'), JSON.stringify(jsonConfig, null, 2));

    const config = await loadConfig(subDir);

    expect(config).toStrictEqual(jsonConfig);
  });

  test('should handle TypeScript config in custom root', async () => {
    const subDir = path.join(testDir, 'subdir');
    fs.mkdirSync(subDir, { recursive: true });

    const tsConfig = { name: 'subdir-ts-config', version: '1.0.0' };
    fs.writeFileSync(
      path.join(subDir, 'shellui.config.ts'),
      `export default ${JSON.stringify(tsConfig)};`,
    );

    const config = await loadConfig(subDir);

    expect(config).toStrictEqual(tsConfig);
  });

  test('should handle errors gracefully and return empty object', async () => {
    const invalidJsonPath = path.join(testDir, 'shellui.config.json');
    fs.writeFileSync(invalidJsonPath, '{ invalid json }');

    const config = await loadConfig('.');

    // Should return empty object on error
    expect(config).toStrictEqual({});
  });

  test('should handle invalid TypeScript config gracefully', async () => {
    const invalidTsPath = path.join(testDir, 'shellui.config.ts');
    fs.writeFileSync(invalidTsPath, 'export const invalid = syntax error;');

    const config = await loadConfig('.');

    // Should return empty object on error
    expect(config).toStrictEqual({});
  });

  test('should work with relative path', async () => {
    const jsonConfig = { name: 'relative-config', version: '1.0.0' };
    fs.writeFileSync('shellui.config.json', JSON.stringify(jsonConfig, null, 2));

    // Change to parent directory
    process.chdir(path.dirname(testDir));

    const config = await loadConfig(path.basename(testDir));

    expect(config).toStrictEqual(jsonConfig);
  });
});
