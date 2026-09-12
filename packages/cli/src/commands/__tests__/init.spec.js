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

    await initCommand(projectDir, { framework: 'empty', backend: 'none' });

    const configPath = path.join(projectDir, MAIN_CONFIG_FILE);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.backend).toBeUndefined();
    expect(config.port).toBe(4000);
    expect(fs.existsSync(path.join(projectDir, 'static', 'favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'static', 'logo.svg'))).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf-8')).toContain('dist/');
  });

  test('--backend shellui --company-id writes BackendConfig defaults + companyId', async () => {
    const projectDir = path.join(testRoot, 'shellui-backend');
    fs.mkdirSync(projectDir);

    await initCommand(projectDir, {
      framework: 'empty',
      backend: 'shellui',
      companyId: '123',
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

    await initCommand(projectDir, { framework: 'empty', backend: 'none' });
    expect(JSON.parse(fs.readFileSync(configPath, 'utf-8')).title).toBe('Old App');

    await initCommand(projectDir, { framework: 'empty', backend: 'none', force: true });
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.title).toBe('My App');
    expect(config.port).toBe(4000);
  });

  test('positional framework shortcuts resolve like --framework flags', () => {
    expect(parseInitArgs('react')).toEqual({ root: '.', frameworkShortcut: 'react' });
    expect(parseInitArgs('vue')).toEqual({ root: '.', frameworkShortcut: 'vue' });
    expect(parseInitArgs('angular')).toEqual({ root: '.', frameworkShortcut: 'angular' });
    expect(parseInitArgs('empty')).toEqual({ root: '.', frameworkShortcut: 'empty' });
  });

  test('positional/flag react scaffolding copies local template when in monorepo', async () => {
    const projectDir = path.join(testRoot, 'react-local');
    fs.mkdirSync(projectDir);

    const cwd = process.cwd();
    process.chdir(repoRoot);
    try {
      await initCommand(projectDir, { framework: 'react', backend: 'none' });
    } finally {
      process.chdir(cwd);
    }

    expect(fs.existsSync(path.join(projectDir, MAIN_CONFIG_FILE))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
  });
});
