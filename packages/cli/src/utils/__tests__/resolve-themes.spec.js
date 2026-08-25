import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import {
  resolveConfigThemes,
  loadThemesFromDir,
  validateThemeJson,
  loadBuiltinThemes,
  resetThemeCaches,
  resolveThemeSchemaPath,
  resolveCuratedThemesPath,
} from '../resolve-themes.js';
import { loadConfig } from '../config.js';
import { MAIN_CONFIG_FILE } from '../config-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'test-fixtures-themes');
const originalCwd = process.cwd();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('resolve-themes', () => {
  beforeEach(() => {
    resetThemeCaches();
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
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
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    resetThemeCaches();
  });

  test('curated-themes.json validates each theme against theme schema', () => {
    const curated = JSON.parse(fs.readFileSync(resolveCuratedThemesPath(), 'utf8'));
    expect(curated.version).toBe(1);
    expect(curated.themes.length).toBe(2);
    for (const theme of curated.themes) {
      expect(() => validateThemeJson(theme, { source: theme.name })).not.toThrow();
    }
  });

  test('theme schema file exists and compiles', () => {
    const schema = JSON.parse(fs.readFileSync(resolveThemeSchemaPath(), 'utf8'));
    const ajv = new Ajv({ strict: false });
    expect(() => ajv.compile(schema)).not.toThrow();
  });

  test('resolves theme: "shellui" via loadConfig', async () => {
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ title: 'themed', theme: 'shellui' }));
    const config = await loadConfig('.');
    expect(config.themes).toHaveLength(1);
    expect(config.themes[0].name).toBe('shellui');
    expect(config.defaultTheme).toBe('shellui');
    expect(config.activeTheme).toBe('shellui');
    expect(config.theme).toBeUndefined();
  });

  test('resolves themes array of built-in names', async () => {
    fs.writeFileSync(
      MAIN_CONFIG_FILE,
      JSON.stringify({
        title: 'multi',
        themes: ['shellui', 'claude'],
        activeTheme: 'claude',
      }),
    );
    const config = await loadConfig('.');
    expect(config.themes.map((t) => t.name)).toEqual(['shellui', 'claude']);
    expect(config.activeTheme).toBe('claude');
  });

  test('loads themesDir JSON files with schema validation', () => {
    const themesDir = path.join(testDir, 'themes');
    fs.mkdirSync(themesDir, { recursive: true });
    fs.writeFileSync(
      path.join(themesDir, 'acme.json'),
      JSON.stringify({
        version: 1,
        name: 'acme',
        label: 'Acme',
        light: { primary: '#AABBCC' },
        dark: { primary: '#CCDDEE' },
      }),
    );
    fs.mkdirSync(path.join(themesDir, 'acme', 'fonts'), { recursive: true });
    fs.writeFileSync(path.join(themesDir, 'acme', 'fonts', 'Custom.woff2'), 'fake');

    const { byName } = loadThemesFromDir(themesDir);
    expect(byName.acme.displayName).toBe('Acme');
    expect(byName.acme.colors.light.primary).toBe('#AABBCC');
    expect(byName.acme.fontFiles?.[0]).toContain('/themes/acme/fonts/Custom.woff2');
  });

  test('resolveConfigThemes expands themesDir into themes[]', () => {
    const themesDir = path.join(testDir, 'my-themes');
    fs.mkdirSync(themesDir, { recursive: true });
    fs.writeFileSync(
      path.join(themesDir, 'brand.json'),
      JSON.stringify({
        version: 1,
        name: 'brand',
        label: 'Brand',
        radius: '0.25rem',
        light: { primary: '#010203' },
        dark: { primary: '#030201' },
      }),
    );

    const config = resolveConfigThemes(
      { themesDir: './my-themes', activeTheme: 'brand' },
      { configDir: testDir, projectRoot: testDir },
    );
    expect(config.themes).toHaveLength(1);
    expect(config.themes[0].name).toBe('brand');
    expect(config.themes[0].colors.light.radius).toBe('0.25rem');
    expect(config.__themesDirAbs).toBe(themesDir);
  });

  test('rejects theme JSON missing version', () => {
    expect(() =>
      validateThemeJson({ name: 'x', light: {}, dark: {} }, { source: 'bad.json' }),
    ).toThrow(/Invalid Shellui theme/);
  });

  test('loadBuiltinThemes includes shellui (and default alias)', () => {
    const builtins = loadBuiltinThemes();
    expect(builtins.shellui.name).toBe('shellui');
    expect(builtins.default.name).toBe('shellui');
    expect(Object.keys(builtins).filter((k) => k !== 'default').length).toBe(2);
  });
});
