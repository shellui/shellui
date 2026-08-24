import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { migrateTsConfig } from '../migrate-config.js';
import { MAIN_CONFIG_FILE, TS_CONFIG_BACKUP_FILE, TS_CONFIG_FILE } from '../config-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = path.join(__dirname, 'test-fixtures-migrate');
const originalCwd = process.cwd();

describe('migrateTsConfig', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('errors when no TypeScript config exists', async () => {
    await expect(migrateTsConfig(testDir)).rejects.toThrow(/nothing to migrate/i);
  });

  test('migrates by evaluating TS and creates .bak', async () => {
    fs.writeFileSync(TS_CONFIG_FILE, `export default { title: 'Migrated', port: 4000 };\n`);

    const result = await migrateTsConfig(testDir);

    expect(fs.existsSync(result.jsonPath)).toBe(true);
    expect(fs.existsSync(result.backupPath)).toBe(true);
    expect(fs.existsSync(path.join(testDir, TS_CONFIG_FILE))).toBe(false);
    expect(fs.existsSync(path.join(testDir, TS_CONFIG_BACKUP_FILE))).toBe(true);

    const json = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
    expect(json.title).toBe('Migrated');
    expect(json.port).toBe(4000);
    expect(json.$schema).toContain('shellui.config.schema.json');
  });

  test('evaluates runtime values into JSON (env / computed)', async () => {
    process.env.SHELLUI_MIGRATE_TEST_TITLE = 'FromEnv';
    fs.writeFileSync(
      TS_CONFIG_FILE,
      `export default { title: process.env.SHELLUI_MIGRATE_TEST_TITLE || 'fallback', port: 1 + 2 };\n`,
    );

    try {
      const result = await migrateTsConfig(testDir);
      const json = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
      expect(json.title).toBe('FromEnv');
      expect(json.port).toBe(3);
    } finally {
      delete process.env.SHELLUI_MIGRATE_TEST_TITLE;
    }
  });

  test('inlines file contents from readFileSync', async () => {
    fs.writeFileSync('privacy.md', '# Privacy\n');
    fs.writeFileSync(
      TS_CONFIG_FILE,
      `import { readFileSync } from 'fs';
export default {
  title: 'Legal',
  legalDocuments: {
    privacyPolicy: readFileSync('./privacy.md', 'utf8'),
  },
};
`,
    );

    const result = await migrateTsConfig(testDir);
    const json = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
    expect(json.legalDocuments.privacyPolicy).toBe('# Privacy\n');
  });

  test('does not overwrite existing JSON', async () => {
    fs.writeFileSync(TS_CONFIG_FILE, `export default { title: 'ts' };\n`);
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ title: 'json' }));

    await expect(migrateTsConfig(testDir)).rejects.toThrow(/already exists/);
    expect(fs.existsSync(path.join(testDir, TS_CONFIG_FILE))).toBe(true);
  });
});
