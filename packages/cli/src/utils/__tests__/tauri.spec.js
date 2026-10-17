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
  capitalizePackageName,
  resolveDefaultProductName,
  mergeProjectTauriOverrides,
  resolveIconFromProjectTauriConf,
  toCargoPackageName,
  toCargoBinName,
  toRustCrateIdent,
  syncCargoPackageName,
  syncShellCapabilities,
  syncDesktopSignIn,
  SHELL_WINDOW_PERMISSIONS,
  DESKTOP_SIGN_IN_PERMISSIONS,
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

  test('tauri template uses overlay titlebar without a native title', () => {
    const confPath = path.join(getTauriTemplateDir(), 'src-tauri', 'tauri.conf.json');
    const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
    const windowConf = conf.app.windows[0];
    expect(windowConf.hiddenTitle).toBe(true);
    expect(windowConf.titleBarStyle).toBe('Overlay');
    expect(windowConf.decorations).toBe(true);
    expect(windowConf.acceptFirstMouse).toBe(true);
    expect(windowConf.trafficLightPosition).toEqual({ x: 16, y: 24 });
  });

  test('tauri template allows window start-dragging', () => {
    const capsPath = path.join(getTauriTemplateDir(), 'src-tauri', 'capabilities', 'default.json');
    const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
    expect(caps.permissions).toContain('core:window:allow-start-dragging');
  });

  test('tauri template lets desktop sign-in bring the window forward', () => {
    const capsPath = path.join(getTauriTemplateDir(), 'src-tauri', 'capabilities', 'default.json');
    const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
    expect(caps.permissions).toEqual(expect.arrayContaining(SHELL_WINDOW_PERMISSIONS));
    expect(caps.permissions).toEqual(expect.arrayContaining(DESKTOP_SIGN_IN_PERMISSIONS));
  });

  test('tauri template opens the system browser for desktop sign-in', () => {
    const templateSrc = path.join(getTauriTemplateDir(), 'src-tauri');
    const lib = fs.readFileSync(path.join(templateSrc, 'src', 'lib.rs'), 'utf8');
    const cargo = fs.readFileSync(path.join(templateSrc, 'Cargo.toml'), 'utf8');
    expect(lib).toContain('tauri_plugin_opener::init()');
    expect(lib).toContain('tauri_plugin_deep_link::init()');
    expect(cargo).toContain('tauri-plugin-opener');
    expect(cargo).toContain('tauri-plugin-deep-link');
  });

  test('syncDesktopSignIn adds the opener plugin to an older app', () => {
    const srcTauri = path.join(testDir, 'src-tauri');
    fs.mkdirSync(path.join(srcTauri, 'src'), { recursive: true });
    fs.mkdirSync(path.join(srcTauri, 'capabilities'), { recursive: true });
    fs.writeFileSync(
      path.join(srcTauri, 'Cargo.toml'),
      ['[dependencies]', 'tauri = { version = "2", features = [] }', 'serde_json = "1"', ''].join(
        '\n',
      ),
    );
    fs.writeFileSync(
      path.join(srcTauri, 'src', 'lib.rs'),
      [
        'pub fn run() {',
        '    tauri::Builder::default()',
        '        .setup(|app| {',
        '            Ok(())',
        '        })',
        '        .run(tauri::generate_context!())',
        '        .expect("error while running tauri application");',
        '}',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(srcTauri, 'capabilities', 'default.json'),
      JSON.stringify({
        identifier: 'default',
        windows: ['main'],
        permissions: ['core:default'],
      }),
    );

    syncDesktopSignIn(srcTauri);

    const cargo = fs.readFileSync(path.join(srcTauri, 'Cargo.toml'), 'utf8');
    const lib = fs.readFileSync(path.join(srcTauri, 'src', 'lib.rs'), 'utf8');
    const caps = JSON.parse(
      fs.readFileSync(path.join(srcTauri, 'capabilities', 'default.json'), 'utf8'),
    );
    expect(cargo).toContain('tauri-plugin-opener = "2"');
    expect(cargo).toContain('tauri-plugin-deep-link = "2"');
    expect(lib).toContain('.plugin(tauri_plugin_opener::init())');
    expect(lib).toContain('.plugin(tauri_plugin_deep_link::init())');
    expect(caps.permissions).toEqual(expect.arrayContaining(DESKTOP_SIGN_IN_PERMISSIONS));

    const cargoAfter = fs.readFileSync(path.join(srcTauri, 'Cargo.toml'), 'utf8');
    const libAfter = fs.readFileSync(path.join(srcTauri, 'src', 'lib.rs'), 'utf8');
    syncDesktopSignIn(srcTauri);
    expect(fs.readFileSync(path.join(srcTauri, 'Cargo.toml'), 'utf8')).toBe(cargoAfter);
    expect(fs.readFileSync(path.join(srcTauri, 'src', 'lib.rs'), 'utf8')).toBe(libAfter);
  });

  test('syncShellCapabilities adds missing window permissions to an older app', () => {
    const srcTauri = path.join(testDir, 'src-tauri');
    const capsPath = path.join(srcTauri, 'capabilities', 'default.json');
    fs.mkdirSync(path.dirname(capsPath), { recursive: true });
    fs.writeFileSync(
      capsPath,
      JSON.stringify({
        identifier: 'default',
        windows: ['main'],
        permissions: ['core:default', 'core:window:allow-start-dragging', 'deep-link:default'],
      }),
    );

    syncShellCapabilities(srcTauri);
    const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
    expect(caps.permissions).toEqual([
      'core:default',
      'core:window:allow-start-dragging',
      'deep-link:default',
      'core:window:allow-unminimize',
      'core:window:allow-show',
      'core:window:allow-set-focus',
    ]);

    const synced = fs.readFileSync(capsPath, 'utf8');
    const mtime = fs.statSync(capsPath).mtimeMs;
    syncShellCapabilities(srcTauri);
    expect(fs.readFileSync(capsPath, 'utf8')).toBe(synced);
    expect(fs.statSync(capsPath).mtimeMs).toBe(mtime);
  });

  test('tauri template ships default icon.png', () => {
    const iconPng = path.join(getTauriTemplateDir(), 'src-tauri/icons/icon.png');
    expect(fs.existsSync(iconPng)).toBe(true);
  });

  test('capitalizePackageName strips scope and uppercases first letter', () => {
    expect(capitalizePackageName('shellui')).toBe('Shellui');
    expect(capitalizePackageName('@shellui/tauri')).toBe('Tauri');
    expect(capitalizePackageName('my-app')).toBe('My-app');
  });

  test('resolveDefaultProductName prefers package.json name', () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ name: 'acme-shell' }),
      'utf-8',
    );
    expect(resolveDefaultProductName(testDir, { title: 'Ignored Title' })).toBe('Acme-shell');
  });

  test('resolveDefaultProductName falls back to shellui title', () => {
    expect(resolveDefaultProductName(testDir, { title: 'My App' })).toBe('My App');
  });

  test('mergeProjectTauriOverrides applies productName and window fields', () => {
    const conf = {
      productName: 'Default',
      identifier: 'com.shellui.default',
      app: { windows: [{ title: 'Default', width: 800 }] },
      bundle: { targets: ['app'] },
    };
    mergeProjectTauriOverrides(conf, {
      productName: 'Custom',
      identifier: 'com.example.custom',
      app: { windows: [{ width: 1200 }] },
      bundle: { targets: ['app', 'dmg'], icon: ['static/icon.png'] },
    });
    expect(conf.productName).toBe('Custom');
    expect(conf.identifier).toBe('com.example.custom');
    expect(conf.app.windows[0]).toEqual({ title: 'Default', width: 1200 });
    expect(conf.bundle.targets).toEqual(['app', 'dmg']);
    expect(conf.bundle.icon).toBeUndefined();
  });

  test('mergeProjectTauriOverrides copies deep-link schemes', () => {
    const conf = { productName: 'Default', plugins: { opener: { open: true } } };
    mergeProjectTauriOverrides(conf, {
      plugins: {
        'deep-link': { desktop: { schemes: ['shellui-playground'] } },
      },
    });
    expect(conf.plugins.opener).toEqual({ open: true });
    expect(conf.plugins['deep-link']).toEqual({
      desktop: { schemes: ['shellui-playground'] },
    });
  });

  test('resolveIconFromProjectTauriConf reads project-relative source icons', () => {
    fs.mkdirSync(path.join(testDir, 'static'), { recursive: true });
    const iconPath = path.join(testDir, 'static', 'icon.png');
    fs.writeFileSync(iconPath, 'fake');
    expect(
      resolveIconFromProjectTauriConf(testDir, { bundle: { icon: ['static/icon.png'] } }),
    ).toBe(iconPath);
    expect(
      resolveIconFromProjectTauriConf(testDir, { bundle: { icon: ['icons/icon.png'] } }),
    ).toBeNull();
  });

  test('toCargoPackageName uses snake/kebab case for rustc', () => {
    expect(toCargoPackageName('Shellui')).toBe('shellui');
    expect(toCargoPackageName('My App')).toBe('my-app');
    expect(toCargoPackageName('123')).toBe('app-123');
    expect(toRustCrateIdent('my-app')).toBe('my_app');
    expect(toCargoBinName('Shellui')).toBe('Shellui');
  });

  test('syncCargoPackageName rewrites Cargo.toml package name', () => {
    const srcTauri = path.join(testDir, 'src-tauri');
    fs.mkdirSync(path.join(srcTauri, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(srcTauri, 'Cargo.toml'),
      '[package]\nname = "shellui-app"\nversion = "0.1.0"\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(srcTauri, 'src', 'main.rs'),
      'fn main() {\n    shellui_app::run()\n}\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(srcTauri, 'Cargo.lock'),
      '# lock\n\n[[package]]\nname = "shellui-app"\nversion = "0.1.0"\n',
      'utf-8',
    );
    syncCargoPackageName(srcTauri, 'Shellui');
    const cargoToml = fs.readFileSync(path.join(srcTauri, 'Cargo.toml'), 'utf-8');
    expect(cargoToml).toContain('name = "shellui"');
    expect(cargoToml).toContain('name = "Shellui"');
    expect(cargoToml).toContain('default-run = "Shellui"');
    expect(fs.readFileSync(path.join(srcTauri, 'src', 'main.rs'), 'utf-8')).toContain(
      'shellui::run()',
    );
    expect(fs.readFileSync(path.join(srcTauri, 'Cargo.lock'), 'utf-8')).toContain(
      'name = "shellui"',
    );
  });
});
