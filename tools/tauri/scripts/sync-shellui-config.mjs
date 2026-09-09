#!/usr/bin/env node
/**
 * Syncs desktop name/icon/port from shellui config + optional root tauri.conf.json
 * into tools/tauri/src-tauri/tauri.conf.json.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(pkgDir, '../..');
const jsonConfigPath = path.join(rootDir, 'shellui.config.json');
const tsConfigPath = path.join(rootDir, 'shellui.config.ts');
const projectTauriConfPath = path.join(rootDir, 'tauri.conf.json');
const tauriConfPath = path.join(pkgDir, 'src-tauri', 'tauri.conf.json');
const staticDir = path.join(rootDir, 'static');
const iconsDir = path.join(pkgDir, 'src-tauri', 'icons');

const SPLIT_RE = /^shellui\.(.+)\.config\.json$/;

function loadJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function capitalizePackageName(name) {
  const base = String(name || '')
    .trim()
    .replace(/^@[^/]+\//, '');
  if (!base) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function toCargoPackageName(productName) {
  const cleaned = String(productName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) return 'shellui';
  if (/^[0-9]/.test(cleaned)) return `app-${cleaned}`;
  return cleaned;
}

function toRustCrateIdent(cargoPackageName) {
  return toCargoPackageName(cargoPackageName).replace(/-/g, '_');
}

function toCargoBinName(productName) {
  const cleaned = String(productName || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) return 'Shellui';
  if (/^[0-9]/.test(cleaned)) return `App-${cleaned}`;
  return cleaned;
}

function syncCargoPackageName(productName) {
  const cargoTomlPath = path.join(pkgDir, 'src-tauri', 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) return;

  const cargoName = toCargoPackageName(productName);
  const binName = toCargoBinName(productName);
  const crateIdent = toRustCrateIdent(cargoName);
  const original = fs.readFileSync(cargoTomlPath, 'utf8');
  const currentMatch = original.match(/^name\s*=\s*"([^"]*)"/m);
  const previousName = currentMatch?.[1];

  let next = original.replace(/^name\s*=\s*"[^"]*"/m, `name = "${cargoName}"`);

  if (/^\[\[bin\]\]/m.test(next)) {
    next = next.replace(
      /(\[\[bin\]\]\s*\n(?:(?!\[\[)[^\n]*\n)*?name\s*=\s*")[^"]*(")/m,
      `$1${binName}$2`,
    );
    if (!/^default-run\s*=/m.test(next)) {
      next = next.replace(/^(version\s*=\s*"[^"]*")/m, `$1\ndefault-run = "${binName}"`);
    } else {
      next = next.replace(/^default-run\s*=\s*"[^"]*"/m, `default-run = "${binName}"`);
    }
  } else {
    if (!/^default-run\s*=/m.test(next)) {
      next = next.replace(/^(version\s*=\s*"[^"]*")/m, `$1\ndefault-run = "${binName}"`);
    } else {
      next = next.replace(/^default-run\s*=\s*"[^"]*"/m, `default-run = "${binName}"`);
    }
    next = `${next.trimEnd()}\n\n[[bin]]\nname = "${binName}"\npath = "src/main.rs"\n`;
  }

  if (next !== original) {
    fs.writeFileSync(cargoTomlPath, next, 'utf8');
    console.log(`Synced Cargo package/bin -> ${cargoName} / ${binName}`);
  }

  const mainRsPath = path.join(pkgDir, 'src-tauri', 'src', 'main.rs');
  if (fs.existsSync(mainRsPath)) {
    const mainOriginal = fs.readFileSync(mainRsPath, 'utf8');
    const mainNext = mainOriginal.replace(
      /\b[A-Za-z_][A-Za-z0-9_]*::run\s*\(\s*\)/g,
      `${crateIdent}::run()`,
    );
    if (mainNext !== mainOriginal) {
      fs.writeFileSync(mainRsPath, mainNext, 'utf8');
      console.log(`Synced main.rs crate path -> ${crateIdent}::run()`);
    }
  }

  const lockPath = path.join(pkgDir, 'src-tauri', 'Cargo.lock');
  if (!previousName || previousName === cargoName || !fs.existsSync(lockPath)) return;
  const lockOriginal = fs.readFileSync(lockPath, 'utf8');
  const lockNext = lockOriginal
    .replaceAll(`name = "${previousName}"`, `name = "${cargoName}"`)
    .replaceAll(`"${previousName} `, `"${cargoName} `);
  if (lockNext !== lockOriginal) {
    fs.writeFileSync(lockPath, lockNext, 'utf8');
  }
}

function resolveDefaultProductName(shelluiConfig) {
  const pkg = loadJsonFile(path.join(rootDir, 'package.json'));
  const fromPkg = capitalizePackageName(pkg?.name);
  if (fromPkg) return fromPkg;
  if (typeof shelluiConfig?.title === 'string' && shelluiConfig.title.trim()) {
    return shelluiConfig.title.trim();
  }
  return 'Shellui';
}

function mergeProjectTauriOverrides(tauriConf, overrides) {
  if (!overrides || typeof overrides !== 'object') return;
  for (const key of ['productName', 'identifier', 'version', 'mainBinaryName']) {
    if (overrides[key] != null && overrides[key] !== '') {
      tauriConf[key] = overrides[key];
    }
  }
  if (overrides.app && typeof overrides.app === 'object') {
    tauriConf.app = tauriConf.app || {};
    if (overrides.app.windows?.[0] && tauriConf.app.windows?.[0]) {
      Object.assign(tauriConf.app.windows[0], overrides.app.windows[0]);
    }
    for (const [k, v] of Object.entries(overrides.app)) {
      if (k === 'windows') continue;
      tauriConf.app[k] = v;
    }
  }
  if (overrides.bundle && typeof overrides.bundle === 'object') {
    tauriConf.bundle = tauriConf.bundle || {};
    for (const [k, v] of Object.entries(overrides.bundle)) {
      if (k === 'icon') continue;
      tauriConf.bundle[k] = v;
    }
  }
}

function resolveIconFromProjectTauriConf(projectTauriConf) {
  const icons = projectTauriConf?.bundle?.icon;
  if (!icons) return null;
  const list = Array.isArray(icons) ? icons : [icons];
  for (const entry of list) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const rel = entry.replace(/^\.\//, '').replace(/^\//, '');
    const abs = path.isAbsolute(entry) ? entry : path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    if (/^icons\//.test(rel.replace(/\\/g, '/'))) continue;
    if (/\.(png|svg|jpe?g|ico|icns)$/i.test(abs)) return abs;
  }
  return null;
}

function loadSplitConfigs() {
  const files = fs.readdirSync(rootDir).filter((name) => {
    if (name === 'shellui.config.json') return false;
    return SPLIT_RE.test(name);
  });
  if (!files.length) return null;

  const merged = {};
  for (const name of files.sort()) {
    const data = loadJsonFile(path.join(rootDir, name));
    if (!data || typeof data !== 'object') continue;
    const { $schema, ...rest } = data;
    Object.assign(merged, rest);
  }
  return merged;
}

function loadTypeScriptConfig() {
  if (!fs.existsSync(tsConfigPath)) {
    return null;
  }
  const fileUrl = pathToFileURL(path.resolve(tsConfigPath)).href;
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'tsx',
      '-e',
      `import(${JSON.stringify(fileUrl)}).then(m => console.log(JSON.stringify(m.default)))`,
    ],
    { cwd: rootDir, encoding: 'utf8', shell: true },
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

function loadShellUIConfig() {
  const hasMain = fs.existsSync(jsonConfigPath);
  const splitFiles = fs.readdirSync(rootDir).filter(
    (name) => name !== 'shellui.config.json' && SPLIT_RE.test(name),
  );

  if (hasMain && splitFiles.length) {
    console.warn(
      'Both shellui.config.json and split config files exist; refusing to sync. Resolve with shellui config unsplit or remove extras.',
    );
    return null;
  }

  if (hasMain) {
    const data = loadJsonFile(jsonConfigPath);
    if (!data) return null;
    const { $schema, ...rest } = data;
    return rest;
  }

  if (splitFiles.length) {
    return loadSplitConfigs();
  }

  return loadTypeScriptConfig();
}

const config = loadShellUIConfig();
const projectTauriConf = loadJsonFile(projectTauriConfPath);
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

const productName = resolveDefaultProductName(config);
const identifierSlug =
  productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-+|-+$/g, '') || 'app';

tauriConf.productName = productName;
tauriConf.identifier = `com.shellui.${identifierSlug}`;
if (tauriConf.app?.windows?.[0]) {
  tauriConf.app.windows[0].title = productName;
  tauriConf.app.windows[0].hiddenTitle = true;
  tauriConf.app.windows[0].titleBarStyle = 'Overlay';
  tauriConf.app.windows[0].decorations = true;
  tauriConf.app.windows[0].acceptFirstMouse = true;
  tauriConf.app.windows[0].trafficLightPosition = { x: 16, y: 24 };
}

if (projectTauriConf) {
  mergeProjectTauriOverrides(tauriConf, projectTauriConf);
}

if (
  tauriConf.app?.windows?.[0] &&
  !(projectTauriConf?.app?.windows?.[0] && 'title' in projectTauriConf.app.windows[0])
) {
  tauriConf.app.windows[0].title = tauriConf.productName;
}

syncCargoPackageName(tauriConf.productName);

if (config?.port != null) {
  tauriConf.build.devUrl = `http://localhost:${config.port}`;
}

const iconCandidates = [
  resolveIconFromProjectTauriConf(projectTauriConf),
  path.join(staticDir, 'icon.png'),
  config?.favicon ? path.join(rootDir, String(config.favicon).replace(/^\//, '')) : null,
  path.join(staticDir, 'favicon.svg'),
  config?.appIcon ? path.join(rootDir, String(config.appIcon).replace(/^\//, '')) : null,
].filter(Boolean);
const iconPath = iconCandidates.find((p) => fs.existsSync(p));
if (iconPath) {
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  const ext = path.extname(iconPath);
  const destName = ext === '.svg' ? 'icon.svg' : `icon${ext}`;
  const destPath = path.join(iconsDir, destName);
  fs.copyFileSync(iconPath, destPath);

  tauriConf.bundle = tauriConf.bundle || {};
  console.log(`Generating platform icons from ${path.basename(iconPath)}...`);
  const iconResult = spawnSync('pnpm', ['exec', 'tauri', 'icon', destPath], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell: true,
  });

  if (iconResult.status === 0) {
    tauriConf.bundle.icon = [
      'icons/32x32.png',
      'icons/128x128.png',
      'icons/128x128@2x.png',
      'icons/icon.icns',
      'icons/icon.ico',
    ];
    console.log('✓ Platform icons generated successfully');
  } else {
    console.warn('⚠ Could not generate icons (tauri CLI may not be installed yet)');
    console.warn(`  Run: pnpm exec tauri icon src-tauri/icons/${destName}`);
    if (ext !== '.svg') {
      tauriConf.bundle.icon = [`icons/${destName}`];
    } else {
      delete tauriConf.bundle.icon;
    }
  }
}

fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(
  `Synced desktop config -> tauri.conf.json (productName=${tauriConf.productName})`,
);
