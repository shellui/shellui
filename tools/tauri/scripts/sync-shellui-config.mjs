#!/usr/bin/env node
/**
 * Syncs title and icon from shellui.config.ts (at repo root) into tauri.conf.json.
 * Run from tools/tauri (or repo root with correct paths).
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(pkgDir, '../..');
const configPath = path.join(rootDir, 'shellui.config.ts');
const tauriConfPath = path.join(pkgDir, 'src-tauri', 'tauri.conf.json');
const staticDir = path.join(rootDir, 'static');
const iconsDir = path.join(pkgDir, 'src-tauri', 'icons');

function loadShellUIConfig() {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const fileUrl = pathToFileURL(path.resolve(configPath)).href;
  const result = spawnSync(
    'pnpm',
    ['exec', 'tsx', '-e', `import(${JSON.stringify(fileUrl)}).then(m => console.log(JSON.stringify(m.default)))`],
    { cwd: rootDir, encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    console.warn('Could not load shellui.config.ts:', result.stderr || result.error);
    return null;
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return null;
  }
}

const config = loadShellUIConfig();
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

if (config) {
  const title = config.title || 'shellui';
  const identifier = `com.shellui.${title.toLowerCase().replace(/\s+/g, '')}`;
  tauriConf.productName = title;
  tauriConf.identifier = identifier;
  if (tauriConf.app?.windows?.[0]) {
    tauriConf.app.windows[0].title = title;
  }
  if (config.port != null) {
    tauriConf.build.devUrl = `http://localhost:${config.port}`;
  }
}

// Copy app icon: shellui.config.ts appIcon, or static/favicon.svg
const iconPath = config?.appIcon
  ? path.join(rootDir, config.appIcon.replace(/^\//, ''))
  : path.join(staticDir, 'favicon.svg');
if (fs.existsSync(iconPath)) {
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  const ext = path.extname(iconPath);
  const destName = ext === '.svg' ? 'icon.svg' : `icon${ext}`;
  const destPath = path.join(iconsDir, destName);
  fs.copyFileSync(iconPath, destPath);
  
  tauriConf.bundle = tauriConf.bundle || {};
  if (ext === '.svg') {
    // Tauri bundle icons require PNG/ICO/ICNS, not SVG
    // Automatically generate platform icons from SVG using 'tauri icon'
    console.log('Generating platform icons from SVG...');
    const iconResult = spawnSync(
      'pnpm',
      ['exec', 'tauri', 'icon', destPath],
      { cwd: pkgDir, encoding: 'utf8', shell: true }
    );
    
    if (iconResult.status === 0) {
      // Set bundle.icon to the generated platform icons
      // tauri icon generates: 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico
      tauriConf.bundle.icon = [
        'icons/32x32.png',
        'icons/128x128.png',
        'icons/128x128@2x.png',
        'icons/icon.icns',
        'icons/icon.ico'
      ];
      console.log('✓ Platform icons generated successfully');
    } else {
      // If tauri icon fails (e.g., CLI not installed yet), remove icon to avoid compile errors
      console.warn('⚠ Could not generate icons (tauri CLI may not be installed yet)');
      console.warn('  Run: pnpm exec tauri icon src-tauri/icons/icon.svg');
      delete tauriConf.bundle.icon;
    }
  } else {
    // PNG/ICO/ICNS can be used directly
    tauriConf.bundle.icon = [`icons/${destName}`];
  }
}

fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('Synced shellui.config.ts -> tauri.conf.json');
