import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  parsePackageManagerField,
  detectPackageManager,
  formatDevRun,
  formatInstallCommand,
  hasPackageJson,
} from '../package-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testRoot = path.join(__dirname, 'test-fixtures-package-manager');

describe('parsePackageManagerField', () => {
  test('parses Corepack-style packageManager values', () => {
    expect(parsePackageManagerField('pnpm@9.15.0')).toBe('pnpm');
    expect(parsePackageManagerField('yarn@4.0.0')).toBe('yarn');
    expect(parsePackageManagerField('npm@10.9.0')).toBe('npm');
    expect(parsePackageManagerField('bun@1.1.0')).toBe('bun');
  });

  test('returns null for missing or unknown values', () => {
    expect(parsePackageManagerField(undefined)).toBeNull();
    expect(parsePackageManagerField('')).toBeNull();
    expect(parsePackageManagerField('deno@1.0.0')).toBeNull();
    expect(parsePackageManagerField(42)).toBeNull();
  });
});

describe('detectPackageManager', () => {
  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test('prefers packageManager field over lockfiles and PATH', () => {
    fs.writeFileSync(
      path.join(testRoot, 'package.json'),
      JSON.stringify({ name: 'app', packageManager: 'yarn@4.0.0' }),
    );
    fs.writeFileSync(path.join(testRoot, 'pnpm-lock.yaml'), '');
    expect(
      detectPackageManager(testRoot, {
        commandExists: () => true,
      }),
    ).toBe('yarn');
  });

  test('uses lockfiles when packageManager field is absent', () => {
    fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'app' }));
    fs.writeFileSync(path.join(testRoot, 'yarn.lock'), '');
    expect(
      detectPackageManager(testRoot, {
        commandExists: () => true,
      }),
    ).toBe('yarn');
  });

  test('lockfile priority: pnpm > yarn > npm > bun', () => {
    fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'app' }));
    fs.writeFileSync(path.join(testRoot, 'package-lock.json'), '');
    fs.writeFileSync(path.join(testRoot, 'bun.lock'), '');
    expect(detectPackageManager(testRoot, { commandExists: () => false })).toBe('npm');

    fs.writeFileSync(path.join(testRoot, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(testRoot, { commandExists: () => false })).toBe('pnpm');
  });

  test('detects bun.lockb', () => {
    fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'app' }));
    fs.writeFileSync(path.join(testRoot, 'bun.lockb'), '');
    expect(detectPackageManager(testRoot, { commandExists: () => false })).toBe('bun');
  });

  test('falls back to PATH preference: pnpm, yarn, npm', () => {
    fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'app' }));
    expect(
      detectPackageManager(testRoot, {
        commandExists: (cmd) => cmd === 'yarn' || cmd === 'npm',
      }),
    ).toBe('yarn');
    expect(
      detectPackageManager(testRoot, {
        commandExists: (cmd) => cmd === 'npm',
      }),
    ).toBe('npm');
    expect(
      detectPackageManager(testRoot, {
        commandExists: (cmd) => cmd === 'pnpm',
      }),
    ).toBe('pnpm');
  });

  test('returns null when nothing usable is found', () => {
    fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'app' }));
    expect(detectPackageManager(testRoot, { commandExists: () => false })).toBeNull();
  });
});

describe('format helpers / hasPackageJson', () => {
  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test('formatDevRun and formatInstallCommand', () => {
    expect(formatDevRun('pnpm')).toBe('pnpm run dev');
    expect(formatDevRun('npm', 'start')).toBe('npm run start');
    expect(formatInstallCommand('yarn')).toBe('yarn install');
  });

  test('hasPackageJson', () => {
    expect(hasPackageJson(testRoot)).toBe(false);
    fs.writeFileSync(path.join(testRoot, 'package.json'), '{}');
    expect(hasPackageJson(testRoot)).toBe(true);
  });
});
