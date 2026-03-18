import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadTypeScriptConfig } from '../config-loaders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, 'test-fixtures-loaders');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Config Loaders', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Suppress console output during tests
    console.log = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    // Restore console first
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

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

  describe('loadTypeScriptConfig', () => {
    test('should load valid TypeScript config file with default export', async () => {
      const configPath = path.join(testDir, 'test-config.ts');
      const expectedConfig = {
        name: 'test-app',
        version: '2.0.0',
      };

      const tsConfigContent = `export default ${JSON.stringify(expectedConfig)};`;
      fs.writeFileSync(configPath, tsConfigContent);

      const config = await loadTypeScriptConfig(configPath, testDir);

      expect(config).toStrictEqual(expectedConfig);
    });

    test('should load TypeScript config with named export', async () => {
      const configPath = path.join(testDir, 'test-config-named.ts');
      const expectedConfig = {
        name: 'test-app',
        routes: ['/home'],
      };

      const tsConfigContent = `export const config = ${JSON.stringify(expectedConfig)};`;
      fs.writeFileSync(configPath, tsConfigContent);

      const loadedConfig = await loadTypeScriptConfig(configPath, testDir);

      expect(loadedConfig).toStrictEqual(expectedConfig);
    });

    test('should handle TypeScript config with both default and named exports (prefers default)', async () => {
      const configPath = path.join(testDir, 'test-config-both.ts');
      const defaultConfig = { name: 'default' };
      const namedConfig = { name: 'named' };

      const tsConfigContent = `export default ${JSON.stringify(defaultConfig)};\nexport const config = ${JSON.stringify(namedConfig)};`;
      fs.writeFileSync(configPath, tsConfigContent);

      const loadedConfig = await loadTypeScriptConfig(configPath, testDir);

      expect(loadedConfig).toStrictEqual(defaultConfig);
    });

    test('should throw error for invalid TypeScript file', async () => {
      const configPath = path.join(testDir, 'invalid-config.ts');
      fs.writeFileSync(configPath, 'export const invalid = syntax error;');

      await expect(loadTypeScriptConfig(configPath, testDir)).rejects.toThrow(
        /Failed to load TypeScript config/,
      );
    });

    test('should throw error for missing TypeScript file', async () => {
      const configPath = path.join(testDir, 'non-existent.ts');

      await expect(loadTypeScriptConfig(configPath, testDir)).rejects.toThrow(
        /Failed to load TypeScript config/,
      );
    });

    test('should clean up temporary loader script', async () => {
      const configPath = path.join(testDir, 'cleanup-test.ts');
      const expectedConfig = { name: 'cleanup-test' };

      const tsConfigContent = `export default ${JSON.stringify(expectedConfig)};`;
      fs.writeFileSync(configPath, tsConfigContent);

      await loadTypeScriptConfig(configPath, testDir);

      const tempScriptPath = path.join(testDir, '.shellui-config-loader.mjs');
      expect(fs.existsSync(tempScriptPath)).toBe(false);
    });

    test('should handle complex TypeScript config with functions and types', async () => {
      const configPath = path.join(testDir, 'complex-config.ts');
      const expectedConfig = {
        name: 'complex-app',
        settings: {
          port: 3000,
          host: 'localhost',
        },
      };

      const tsConfigContent = `interface Config { name: string; settings: { port: number; host: string; }; }\nconst config: Config = ${JSON.stringify(expectedConfig)};\nexport default config;`;
      fs.writeFileSync(configPath, tsConfigContent);

      const loadedConfig = await loadTypeScriptConfig(configPath, testDir);

      expect(loadedConfig).toStrictEqual(expectedConfig);
    });
  });
});
