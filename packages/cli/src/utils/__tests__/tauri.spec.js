import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DESKTOP_APP_DIR,
  TAURI_APP_DIR,
  getDesktopAppDir,
  getAppDir,
  getTauriTemplateDir,
  detectPackageManager,
  scaffoldTauriApp,
  getShelluiHookCommand,
  ensureDefaultTauriIcons,
  TAURI_BUNDLE_ICONS,
} from '../tauri.js';
import { getProjectRoot } from '../paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'test-fixtures-tauri');
const originalCwd = process.cwd();

describe('tauri utilities', () => {
  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('getProjectRoot resolves relative root against cwd', () => {
    expect(getProjectRoot('.', testDir)).toBe(testDir);
    expect(getProjectRoot('./nested', testDir)).toBe(path.join(testDir, 'nested'));
  });

  test('getDesktopAppDir returns dist/app inside project root', () => {
    expect(getDesktopAppDir('.', testDir)).toBe(path.join(testDir, 'dist', 'app'));
    expect(getAppDir('.', testDir)).toBe(getDesktopAppDir('.', testDir));
    expect(TAURI_APP_DIR).toBe(DESKTOP_APP_DIR);
  });

  test('getTauriTemplateDir points to bundled template', () => {
    const templateDir = getTauriTemplateDir();
    expect(fs.existsSync(templateDir)).toBe(true);
    expect(fs.existsSync(path.join(templateDir, 'src-tauri', 'tauri.conf.json'))).toBe(true);
  });

  test('detectPackageManager reads lockfiles', () => {
    fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '', 'utf-8');
    expect(detectPackageManager(testDir)).toBe('pnpm');

    fs.unlinkSync(path.join(testDir, 'pnpm-lock.yaml'));
    fs.writeFileSync(path.join(testDir, 'yarn.lock'), '', 'utf-8');
    expect(detectPackageManager(testDir)).toBe('yarn');

    fs.unlinkSync(path.join(testDir, 'yarn.lock'));
    expect(detectPackageManager(testDir)).toBe('npm');
  });

  test('scaffoldTauriApp copies template into dist/app', () => {
    const appDir = path.join(testDir, 'dist', 'app');
    scaffoldTauriApp(appDir);

    expect(fs.existsSync(path.join(appDir, 'src-tauri', 'tauri.conf.json'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'src-tauri', 'Cargo.toml'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'src-tauri/icons/icon.png'))).toBe(true);
  });

  test('getShelluiHookCommand uses paths relative to project root', () => {
    const projectRoot = testDir;
    const appDir = path.join(testDir, 'dist', 'app');
    const cliBin = path.join(projectRoot, 'node_modules/@shellui/cli/bin/shellui.js');

    fs.mkdirSync(path.dirname(cliBin), { recursive: true });
    fs.writeFileSync(cliBin, '', 'utf-8');
    scaffoldTauriApp(appDir);

    const command = getShelluiHookCommand(projectRoot, appDir, 'start', { host: true });
    expect(command).toBe(
      'node node_modules/@shellui/cli/bin/shellui.js start --target tauri --host',
    );
  });

  test('ensureDefaultTauriIcons copies bundled icons into app', () => {
    const appDir = path.join(testDir, 'dist', 'app');
    scaffoldTauriApp(appDir);

    const iconsDir = path.join(appDir, 'src-tauri/icons');
    for (const file of ['icon.png', '32x32.png', 'icon.ico']) {
      fs.rmSync(path.join(iconsDir, file), { force: true });
    }

    ensureDefaultTauriIcons(appDir);

    for (const iconPath of TAURI_BUNDLE_ICONS) {
      expect(fs.existsSync(path.join(appDir, 'src-tauri', iconPath))).toBe(true);
    }
  });

  test('tauri template ships default icon.png', () => {
    const iconPng = path.join(getTauriTemplateDir(), 'src-tauri/icons/icon.png');
    expect(fs.existsSync(iconPng)).toBe(true);
  });
});
