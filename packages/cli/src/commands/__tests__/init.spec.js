import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initCommand, parseInitArgs } from '../init.js';
import { MAIN_CONFIG_FILE } from '../../utils/config-paths.js';
import { DEFAULT_SHELLUI_BACKEND_URL } from '../../init/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testRoot = path.join(__dirname, 'test-fixtures-init-command');
const repoRoot = path.resolve(__dirname, '../../../..');

const originalExit = process.exit;
const originalLog = console.log;
const originalError = console.error;
const originalIsTTY = process.stdin.isTTY;

describe('initCommand (non-interactive)', () => {
  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot, { recursive: true });
    process.stdin.isTTY = false;
    console.log = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdin.isTTY = originalIsTTY;
    console.log = originalLog;
    console.error = originalError;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test('--framework empty --backend none writes config without backend and creates static assets', async () => {
    const projectDir = path.join(testRoot, 'empty-none');
    fs.mkdirSync(projectDir);

    await initCommand(projectDir, { framework: 'empty', backend: 'none', install: false });

    const configPath = path.join(projectDir, MAIN_CONFIG_FILE);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.backend).toBeUndefined();
    expect(config.dev).toBeUndefined();
    expect(config.port).toBe(4000);
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe('/');
    expect(fs.existsSync(path.join(projectDir, 'static', 'favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'static', 'logo.svg'))).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf-8')).toContain('dist/');
    expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@shellui/cli']).toBeTruthy();
    expect(pkg.scripts.build).toBe('shellui build');
    expect(config.layout).toBe('fullscreen');
  });

  test('--backend shellui --company-id writes BackendConfig defaults + companyId', async () => {
    const projectDir = path.join(testRoot, 'shellui-backend');
    fs.mkdirSync(projectDir);

    await initCommand(projectDir, {
      framework: 'empty',
      backend: 'shellui',
      companyId: '123',
      install: false,
    });

    const config = JSON.parse(fs.readFileSync(path.join(projectDir, MAIN_CONFIG_FILE), 'utf-8'));
    expect(config.backend).toEqual({
      type: 'shellui',
      url: DEFAULT_SHELLUI_BACKEND_URL,
      companyId: 123,
      login: { methods: ['password', 'oauth'] },
    });
  });

  test('--backend supabase --supabase-url writes type + url', async () => {
    const projectDir = path.join(testRoot, 'supabase-backend');
    fs.mkdirSync(projectDir);

    await initCommand(projectDir, {
      framework: 'empty',
      backend: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      install: false,
    });

    const config = JSON.parse(fs.readFileSync(path.join(projectDir, MAIN_CONFIG_FILE), 'utf-8'));
    expect(config.backend).toEqual({
      type: 'supabase',
      url: 'https://abc.supabase.co',
    });
  });

  test('non-interactive shellui without --company-id exits with clear error', async () => {
    const projectDir = path.join(testRoot, 'shellui-missing-id');
    fs.mkdirSync(projectDir);

    const exitMock = vi.fn();
    process.exit = /** @type {any} */ (exitMock);
    const errors = [];
    console.error = (...args) => {
      errors.push(args.map(String).join(' '));
    };

    await initCommand(projectDir, { framework: 'empty', backend: 'shellui' });

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errors.join('\n')).toMatch(/--company-id is required/);
    expect(fs.existsSync(path.join(projectDir, MAIN_CONFIG_FILE))).toBe(false);
  });

  test('non-interactive supabase without --supabase-url exits with clear error', async () => {
    const projectDir = path.join(testRoot, 'supabase-missing-url');
    fs.mkdirSync(projectDir);

    const exitMock = vi.fn();
    process.exit = /** @type {any} */ (exitMock);
    const errors = [];
    console.error = (...args) => {
      errors.push(args.map(String).join(' '));
    };

    await initCommand(projectDir, { framework: 'empty', backend: 'supabase' });

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errors.join('\n')).toMatch(/--supabase-url is required/);
  });

  test('--force overwrites an existing config', async () => {
    const projectDir = path.join(testRoot, 'force-overwrite');
    fs.mkdirSync(projectDir);
    const configPath = path.join(projectDir, MAIN_CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify({ title: 'Old App' }, null, 2));

    await initCommand(projectDir, { framework: 'empty', backend: 'none', install: false });
    expect(JSON.parse(fs.readFileSync(configPath, 'utf-8')).title).toBe('Old App');

    await initCommand(projectDir, {
      framework: 'empty',
      backend: 'none',
      force: true,
      install: false,
    });
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.title).toBe('My App');
    expect(config.port).toBe(4000);
  });

  test('positional framework shortcuts resolve like --framework flags', () => {
    expect(parseInitArgs('react')).toEqual({ root: '.', frameworkShortcut: 'react' });
    expect(parseInitArgs('vue')).toEqual({ root: '.', frameworkShortcut: 'vue' });
    expect(parseInitArgs('angular')).toEqual({ root: '.', frameworkShortcut: 'angular' });
    expect(parseInitArgs('next')).toEqual({ root: '.', frameworkShortcut: 'next' });
    expect(parseInitArgs('nuxt')).toEqual({ root: '.', frameworkShortcut: 'nuxt' });
    expect(parseInitArgs('svelte')).toEqual({ root: '.', frameworkShortcut: 'svelte' });
    expect(parseInitArgs('alpine')).toEqual({ root: '.', frameworkShortcut: 'alpine' });
    expect(parseInitArgs('empty')).toEqual({ root: '.', frameworkShortcut: 'empty' });
    expect(parseInitArgs('flutter')).toEqual({ root: 'flutter', frameworkShortcut: null });
  });

  test('positional/flag react scaffolding copies local official Vite template', async () => {
    const projectDir = path.join(testRoot, 'react-local');
    fs.mkdirSync(projectDir);

    const cwd = process.cwd();
    process.chdir(repoRoot);
    try {
      // --no-install keeps this unit test fast (install covered separately).
      await initCommand(projectDir, { framework: 'react', backend: 'none', install: false });
    } finally {
      process.chdir(cwd);
    }

    expect(fs.existsSync(path.join(projectDir, MAIN_CONFIG_FILE))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'public', 'favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src', 'assets', 'react.svg'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src', 'assets', 'hero.png'))).toBe(true);
    const app = fs.readFileSync(path.join(projectDir, 'src', 'App.jsx'), 'utf-8');
    expect(app).toMatch(/Get started/);
    expect(app).toMatch(/hero\.png/);
    expect(fs.existsSync(path.join(projectDir, 'src', 'i18n.js'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'src', 'useShellui.js'))).toBe(false);

    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@shellui/cli']).toBeTruthy();
    expect(pkg.scripts.build).toBe('shellui build && vite build');
    expect(pkg.scripts.start).toBe('shellui start');

    const { detectPackageManager, formatDevRun } = await import('../../init/package-manager.js');
    const pm = detectPackageManager(projectDir);
    expect(pm).toBeTruthy();

    const config = JSON.parse(fs.readFileSync(path.join(projectDir, MAIN_CONFIG_FILE), 'utf-8'));
    expect(config.layout).toBe('fullscreen');
    expect(config.dev).toEqual({
      run: formatDevRun(pm),
      url: 'http://localhost:5173',
      name: 'react',
    });
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe(
      '${SHELLUI_APP_URL:-http://localhost:5173}/',
    );
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').path).toBe('');
    expect(config.port).toBe(4000);
    // --no-install must not create node_modules
    expect(fs.existsSync(path.join(projectDir, 'node_modules'))).toBe(false);
  });

  test.each([
    ['next', 'http://localhost:3000', 'package.json'],
    ['nuxt', 'http://localhost:3000', 'package.json'],
    ['svelte', 'http://localhost:5173', 'package.json'],
    ['alpine', 'http://localhost:5173', 'package.json'],
  ])(
    '%s scaffolding copies local template and wires companion',
    async (framework, companionUrl, manifest) => {
      const projectDir = path.join(testRoot, `${framework}-local`);
      fs.mkdirSync(projectDir);

      const cwd = process.cwd();
      process.chdir(repoRoot);
      try {
        await initCommand(projectDir, { framework, backend: 'none', install: false });
      } finally {
        process.chdir(cwd);
      }

      expect(fs.existsSync(path.join(projectDir, MAIN_CONFIG_FILE))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, manifest))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'static', 'favicon.svg'))).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(projectDir, MAIN_CONFIG_FILE), 'utf-8'));
      expect(config.dev.url).toBe(companionUrl);
      expect(config.dev.name).toBe(framework);
      expect(config.dev.run).toMatch(/run dev$/);
      expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe(
        `\${SHELLUI_APP_URL:-${companionUrl}}/`,
      );
      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
      expect(pkg.devDependencies['@shellui/cli']).toBeTruthy();
      expect(pkg.scripts.start).toBe('shellui start');
      expect(pkg.scripts.build).toMatch(/^shellui build/);
      expect(config.layout).toBe('fullscreen');
      expect(config.navigation.find((n) => n.path === '' || n.path === '/').path).toBe('');
      expect(config.port).toBe(4000);

      if (framework === 'svelte') {
        expect(fs.existsSync(path.join(projectDir, 'svelte.config.js'))).toBe(true);
        const svelteCfg = fs.readFileSync(path.join(projectDir, 'svelte.config.js'), 'utf-8');
        expect(svelteCfg).toMatch(/adapter-static/);
        const vite = fs.readFileSync(path.join(projectDir, 'vite.config.js'), 'utf-8');
        expect(vite).toMatch(/strictPort:\s*true/);
      }

      if (framework === 'next') {
        expect(fs.existsSync(path.join(projectDir, 'scripts', 'ensure-port.mjs'))).toBe(true);
        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.scripts.dev).toMatch(/ensure-port\.mjs/);
      }

      if (framework === 'nuxt') {
        const nuxtCfg = fs.readFileSync(path.join(projectDir, 'nuxt.config.ts'), 'utf-8');
        expect(nuxtCfg).toMatch(/strictPort:\s*true/);
      }

      if (framework === 'alpine') {
        const main = fs.readFileSync(path.join(projectDir, 'src', 'main.js'), 'utf-8');
        expect(main).toMatch(/@shellui\/sdk\/tiny/);
        expect(main).toMatch(/shellui\.ready/);
        expect(fs.existsSync(path.join(projectDir, 'src', 'i18n.js'))).toBe(false);
        const html = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf-8');
        expect(html).toMatch(/Get started/);
        const vite = fs.readFileSync(path.join(projectDir, 'vite.config.js'), 'utf-8');
        expect(vite).toMatch(/strictPort:\s*true/);
        expect(vite).toMatch(/5173/);
        expect(vite).toMatch(/dist\/web\/app/);
      }
    },
  );

  test('rejects --framework flutter', async () => {
    const projectDir = path.join(testRoot, 'flutter-rejected');
    fs.mkdirSync(projectDir);

    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    };

    await expect(
      initCommand(projectDir, { framework: 'flutter', backend: 'none', install: false }),
    ).rejects.toThrow(/process\.exit/);
    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(projectDir, MAIN_CONFIG_FILE))).toBe(false);
  });
});
