import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { splitConfig, unsplitConfig, mergeSplitConfigs } from '../config-split.js';
import { MAIN_CONFIG_FILE, splitConfigFileName } from '../config-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = path.join(__dirname, 'test-fixtures-split');
const originalCwd = process.cwd();

describe('split and unsplit config', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('split creates section files and removes main', () => {
    const config = {
      title: 'App',
      port: 4000,
      storage: { url: 'http://localhost:8001' },
      navigation: [{ label: 'Home', path: 'home', url: '/' }],
    };
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(config));

    const { written, removed } = splitConfig(testDir);

    expect(removed).toBe(path.join(testDir, MAIN_CONFIG_FILE));
    expect(fs.existsSync(MAIN_CONFIG_FILE)).toBe(false);
    expect(written.some((p) => p.endsWith(splitConfigFileName('root')))).toBe(true);
    expect(written.some((p) => p.endsWith(splitConfigFileName('storage')))).toBe(true);
    expect(written.some((p) => p.endsWith(splitConfigFileName('navigation')))).toBe(true);

    const root = JSON.parse(fs.readFileSync(splitConfigFileName('root'), 'utf8'));
    expect(root.title).toBe('App');
    expect(root.port).toBe(4000);

    const storage = JSON.parse(fs.readFileSync(splitConfigFileName('storage'), 'utf8'));
    expect(storage.storage).toEqual({ url: 'http://localhost:8001' });
  });

  test('unsplit merges back and preserves semantics', () => {
    const original = {
      title: 'App',
      port: 4000,
      storage: { url: 'http://localhost:8001', showInSettings: false },
      backend: { type: 'shellui', url: 'http://localhost:9000' },
      navigation: [{ label: 'Home', path: 'home', url: '/' }],
    };
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(original));
    splitConfig(testDir);

    const { written } = unsplitConfig(testDir);
    expect(written).toBe(path.join(testDir, MAIN_CONFIG_FILE));
    expect(fs.existsSync(splitConfigFileName('root'))).toBe(false);
    expect(fs.existsSync(splitConfigFileName('storage'))).toBe(false);

    const merged = JSON.parse(fs.readFileSync(MAIN_CONFIG_FILE, 'utf8'));
    const { $schema, ...rest } = merged;
    expect(rest).toEqual(original);
    expect($schema).toContain('shellui.config.schema.json');
  });

  test('mergeSplitConfigs rejects duplicate keys', () => {
    const a = path.join(testDir, 'a.json');
    const b = path.join(testDir, 'b.json');
    fs.writeFileSync(a, JSON.stringify({ title: 'one' }));
    fs.writeFileSync(b, JSON.stringify({ title: 'two' }));

    // Bypass filename rules by calling merge with crafted entries that claim root for both
    // Use real split filenames: write title into root and also into a fake section — section assert fails.
    // Instead call mergeSplitConfigs with two root-named files pointing at a and b:
    expect(() =>
      mergeSplitConfigs([
        { name: 'root', path: a },
        { name: 'root', path: b },
      ]),
    ).toThrow(/Duplicate config key "title"/);
  });

  test('split errors when main config is missing', () => {
    expect(() => splitConfig(testDir)).toThrow(/No shellui\.config\.json/);
  });

  test('unsplit errors when no split files exist', () => {
    expect(() => unsplitConfig(testDir)).toThrow(/No split config files/);
  });
});
