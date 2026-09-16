import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import pc from 'picocolors';
import { loadConfig } from './config.js';
import { resolvePackagePath } from './package-path.js';
import {
  getProjectRoot,
  getDesktopAppDir,
  getAppDir,
  DESKTOP_HOOK_CWD,
  DESKTOP_WEB_DIST,
  DESKTOP_APP_DIR,
  TAURI_APP_DIR,
} from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { DESKTOP_APP_DIR, TAURI_APP_DIR, getDesktopAppDir, getAppDir } from './paths.js';

/** Bundle icon paths required by Tauri at compile time (generate_context!) */
export const TAURI_BUNDLE_ICONS = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.png',
  'icons/icon.icns',
  'icons/icon.ico',
];

const TAURI_CLI_VERSION = '^2.10.0';
const TAURI_API_VERSION = '^2.10.1';

/**
 * Path to the bundled desktop app template inside @shellui/cli
 * @returns {string}
 */
export function getTauriTemplateDir() {
  return path.resolve(__dirname, '../../templates/tauri');
}

/**
 * Detect the package manager used in a project
 * @param {string} projectRoot
 * @returns {'pnpm' | 'yarn' | 'npm'}
 */
export function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Recursively copy a directory
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Run a package manager install command
 * @param {'pnpm' | 'yarn' | 'npm'} pm
 * @param {string} cwd
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function runPackageManager(pm, cwd, args) {
  return new Promise((resolve, reject) => {
    const command = pm === 'yarn' ? 'yarn' : pm;
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

/**
 * Ensure the project has a package.json (required for Tauri CLI deps)
 * @param {string} projectRoot
 */
function ensurePackageJson(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) return;

  const folderName = path.basename(projectRoot) || 'shellui';
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: folderName, private: true, version: '0.1.0' }, null, 2) + '\n',
    'utf-8',
  );
  console.log(pc.green(`Created ${packageJsonPath}`));
}

/**
 * Capitalize the first letter of a package name (strip npm scope).
 * `shellui` → `Shellui`, `@acme/my-app` → `My-app`
 * @param {string} name
 * @returns {string}
 */
export function capitalizePackageName(name) {
  const base = String(name || '')
    .trim()
    .replace(/^@[^/]+\//, '');
  if (!base) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Cargo package name (must be snake/kebab case for rustc).
 * `Shellui` → `shellui`, `My App` → `my-app`
 * @param {string} productName
 * @returns {string}
 */
export function toCargoPackageName(productName) {
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

/**
 * Rust crate identifier used in `main.rs` (`my-app` → `my_app`).
 * @param {string} cargoPackageName
 * @returns {string}
 */
export function toRustCrateIdent(cargoPackageName) {
  return toCargoPackageName(cargoPackageName).replace(/-/g, '_');
}

/**
 * Executable / Dock name during `tauri dev` (may keep capitals).
 * `Shellui` → `Shellui`, `My App` → `My-App`
 * @param {string} productName
 * @returns {string}
 */
export function toCargoBinName(productName) {
  const cleaned = String(productName || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) return 'Shellui';
  if (/^[0-9]/.test(cleaned)) return `App-${cleaned}`;
  return cleaned;
}

/**
 * Keep src-tauri Cargo package + main.rs crate path in sync with productName.
 * On macOS, `tauri dev` shows the binary name in the Dock / app switcher
 * (productName applies to bundled .app builds via Info.plist).
 * @param {string} appSrcTauriDir path to …/src-tauri
 * @param {string} productName
 */
export function syncCargoPackageName(appSrcTauriDir, productName) {
  const cargoTomlPath = path.join(appSrcTauriDir, 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) return;

  const cargoName = toCargoPackageName(productName);
  const binName = toCargoBinName(productName);
  const crateIdent = toRustCrateIdent(cargoName);
  const original = fs.readFileSync(cargoTomlPath, 'utf8');
  const currentMatch = original.match(/^name\s*=\s*"([^"]*)"/m);
  const previousName = currentMatch?.[1];

  let next = original.replace(/^name\s*=\s*"[^"]*"/m, `name = "${cargoName}"`);

  // Prefer a display binary name (Dock) separate from the snake_case package/lib.
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
    console.log(pc.green(`Synced Cargo package/bin -> ${cargoName} / ${binName}`));
  }

  const mainRsPath = path.join(appSrcTauriDir, 'src', 'main.rs');
  if (fs.existsSync(mainRsPath)) {
    const mainOriginal = fs.readFileSync(mainRsPath, 'utf8');
    const mainNext = mainOriginal.replace(
      /\b[A-Za-z_][A-Za-z0-9_]*::run\s*\(\s*\)/g,
      `${crateIdent}::run()`,
    );
    if (mainNext !== mainOriginal) {
      fs.writeFileSync(mainRsPath, mainNext, 'utf8');
      console.log(pc.green(`Synced main.rs crate path -> ${crateIdent}::run()`));
    }
  }

  const lockPath = path.join(appSrcTauriDir, 'Cargo.lock');
  if (!previousName || previousName === cargoName || !fs.existsSync(lockPath)) return;
  const lockOriginal = fs.readFileSync(lockPath, 'utf8');
  const lockNext = lockOriginal
    .replaceAll(`name = "${previousName}"`, `name = "${cargoName}"`)
    .replaceAll(`"${previousName} `, `"${cargoName} `);
  if (lockNext !== lockOriginal) {
    fs.writeFileSync(lockPath, lockNext, 'utf8');
  }
}

/**
 * Default desktop product name: package.json name (capitalized), then shellui title.
 * @param {string} projectRoot
 * @param {Object} [shelluiConfig]
 * @returns {string}
 */
export function resolveDefaultProductName(projectRoot, shelluiConfig) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const fromPkg = capitalizePackageName(pkg.name);
      if (fromPkg) return fromPkg;
    } catch {
      // ignore malformed package.json
    }
  }
  if (typeof shelluiConfig?.title === 'string' && shelluiConfig.title.trim()) {
    return shelluiConfig.title.trim();
  }
  return 'Shellui';
}

/**
 * Load optional project-root tauri.conf.json overrides.
 * @param {string} projectRoot
 * @returns {Record<string, any> | null}
 */
export function loadProjectTauriConf(projectRoot) {
  const projectTauriConfPath = path.join(projectRoot, 'tauri.conf.json');
  if (!fs.existsSync(projectTauriConfPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(projectTauriConfPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid tauri.conf.json at ${projectTauriConfPath}: ${error.message}`);
  }
}

/**
 * Merge project-level tauri.conf.json overrides into the generated config.
 * Icon paths are resolved separately (source asset → generated bundle set).
 * @param {Record<string, any>} tauriConf
 * @param {Record<string, any>} overrides
 */
export function mergeProjectTauriOverrides(tauriConf, overrides) {
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
      if (k === 'icon') continue; // applied after icon generation
      tauriConf.bundle[k] = v;
    }
  }
}

/**
 * Resolve a source icon path declared in root tauri.conf.json bundle.icon.
 * @param {string} projectRoot
 * @param {Record<string, any> | null} projectTauriConf
 * @returns {string | null}
 */
export function resolveIconFromProjectTauriConf(projectRoot, projectTauriConf) {
  const icons = projectTauriConf?.bundle?.icon;
  if (!icons) return null;
  const list = Array.isArray(icons) ? icons : [icons];
  for (const entry of list) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const rel = entry.replace(/^\.\//, '').replace(/^\//, '');
    const abs = path.isAbsolute(entry) ? entry : path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    // Prefer project source assets; skip already-generated template icon paths.
    if (/^icons\//.test(rel.replace(/\\/g, '/'))) continue;
    if (/\.(png|svg|jpe?g|ico|icns)$/i.test(abs)) return abs;
  }
  return null;
}

/**
 * Install @tauri-apps/cli if it is not already available
 * @param {string} projectRoot
 */
export async function ensureTauriDeps(projectRoot) {
  const tauriCliPath = path.join(projectRoot, 'node_modules/@tauri-apps/cli');
  if (fs.existsSync(tauriCliPath)) return;

  ensurePackageJson(projectRoot);
  const pm = detectPackageManager(projectRoot);

  console.log(pc.blue('Installing Tauri dependencies (@tauri-apps/cli, @tauri-apps/api)...'));

  const installArgs =
    pm === 'npm'
      ? [
          'install',
          '--save-dev',
          `@tauri-apps/cli@${TAURI_CLI_VERSION}`,
          `@tauri-apps/api@${TAURI_API_VERSION}`,
        ]
      : pm === 'yarn'
        ? [
            'add',
            '-D',
            `@tauri-apps/cli@${TAURI_CLI_VERSION}`,
            `@tauri-apps/api@${TAURI_API_VERSION}`,
          ]
        : [
            'add',
            '-D',
            `@tauri-apps/cli@${TAURI_CLI_VERSION}`,
            `@tauri-apps/api@${TAURI_API_VERSION}`,
          ];

  await runPackageManager(pm, projectRoot, installArgs);
}

/**
 * Scaffold the desktop app wrapper from the bundled template into dist/app
 * @param {string} appDir
 */
export function scaffoldTauriApp(appDir) {
  const templateDir = getTauriTemplateDir();
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Desktop app template not found at ${templateDir}`);
  }

  copyDir(templateDir, appDir);
  console.log(pc.green(`Created desktop app scaffold at ${DESKTOP_APP_DIR}/`));
}

/**
 * Build the shellui CLI command used in tauri.conf.json hooks
 * @param {string} projectRoot
 * @param {string} appDir
 * @param {'start' | 'build'} command
 * @param {{ host?: boolean }} [options]
 * @returns {string}
 */
export function getShelluiHookCommand(projectRoot, appDir, command, options = {}) {
  const projectCliBin = path.join(projectRoot, 'node_modules/@shellui/cli/bin/shellui.js');
  const cliPackagePath = resolvePackagePath('@shellui/cli');
  const cliBin = path.join(cliPackagePath, 'bin/shellui.js');

  // beforeDevCommand/beforeBuildCommand cwd is the project root (../../.. from dist/app/src-tauri),
  // so script paths must be relative to projectRoot.
  let shelluiCmd;
  if (fs.existsSync(projectCliBin)) {
    shelluiCmd = `node ${toPosixPath(path.relative(projectRoot, projectCliBin))}`;
  } else if (fs.existsSync(cliBin)) {
    shelluiCmd = `node ${toPosixPath(path.relative(projectRoot, cliBin))}`;
  } else {
    shelluiCmd = 'npx shellui';
  }

  const args = [command, '--target', 'tauri'];
  if (command === 'start' && options.host) {
    args.push('--host');
  }

  return `${shelluiCmd} ${args.join(' ')}`;
}

/**
 * Convert Windows paths to POSIX for shell scripts
 * @param {string} value
 * @returns {string}
 */
function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

/**
 * Resolve the tauri CLI binary for a project
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveTauriCli(projectRoot) {
  const localBin = path.join(projectRoot, 'node_modules/.bin/tauri');
  if (fs.existsSync(localBin)) return localBin;
  return 'tauri';
}

/**
 * Resolve the source icon path from config, static assets, or bundled defaults.
 * Prefer an opaque desktop mark (`static/icon.png` / favicon) over `appIcon`,
 * which is often a transparent mono glyph for sidebar chrome and looks wrong in the macOS dock.
 * @param {string} projectRoot
 * @param {Object} config
 * @param {Record<string, any> | null} [projectTauriConf]
 * @returns {string}
 */
export function resolveSourceIconPath(projectRoot, config, projectTauriConf = null) {
  const fromTauriConf = resolveIconFromProjectTauriConf(projectRoot, projectTauriConf);
  if (fromTauriConf) return fromTauriConf;

  const candidates = [];

  const favicon =
    typeof config?.favicon === 'string' ? config.favicon.replace(/^\//, '') : 'favicon.svg';
  candidates.push(path.join(projectRoot, 'static', 'icon.png'));
  candidates.push(path.join(projectRoot, 'static', path.basename(favicon)));
  candidates.push(path.join(projectRoot, favicon));
  candidates.push(path.join(projectRoot, 'static/favicon.svg'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const appIcon =
    typeof config?.appIcon === 'string'
      ? config.appIcon
      : config?.appIcon?.light || config?.appIcon?.dark;

  if (appIcon) {
    const appIconPath = path.join(projectRoot, String(appIcon).replace(/^\//, ''));
    if (fs.existsSync(appIconPath)) return appIconPath;
    const staticPath = path.join(projectRoot, 'static', String(appIcon).replace(/^\//, ''));
    if (fs.existsSync(staticPath)) return staticPath;
  }

  const defaultIcon = path.join(getTauriTemplateDir(), 'src-tauri/icons/icon.svg');
  if (fs.existsSync(defaultIcon)) return defaultIcon;

  throw new Error('No icon source found for Tauri (add static/icon.png or static/favicon.svg)');
}

/**
 * Copy bundled default icons into the app when platform icons are missing.
 * @param {string} appDir
 */
export function ensureDefaultTauriIcons(appDir) {
  const iconsDir = path.join(appDir, 'src-tauri', 'icons');
  const templateIconsDir = path.join(getTauriTemplateDir(), 'src-tauri/icons');

  const hasAllBundleIcons = TAURI_BUNDLE_ICONS.every((iconPath) =>
    fs.existsSync(path.join(appDir, 'src-tauri', iconPath)),
  );
  if (hasAllBundleIcons) return;

  if (!fs.existsSync(templateIconsDir)) {
    throw new Error(`Default Tauri icons not found in CLI template at ${templateIconsDir}`);
  }

  fs.mkdirSync(iconsDir, { recursive: true });
  for (const entry of fs.readdirSync(templateIconsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    fs.copyFileSync(path.join(templateIconsDir, entry.name), path.join(iconsDir, entry.name));
  }
}

/**
 * Generate platform icons from a source image using the Tauri CLI.
 * @param {string} projectRoot
 * @param {string} appDir
 * @param {string} sourceIconPath
 */
export function generateTauriIcons(projectRoot, appDir, sourceIconPath) {
  const iconsDir = path.join(appDir, 'src-tauri', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  const ext = path.extname(sourceIconPath);
  const destName = ext === '.svg' ? 'icon.svg' : `icon${ext}`;
  const destPath = path.join(iconsDir, destName);
  fs.copyFileSync(sourceIconPath, destPath);

  console.log(pc.blue('Generating platform icons from source icon...'));
  const tauriCli = resolveTauriCli(projectRoot);
  const iconResult = spawnSync(tauriCli, ['icon', destPath, '-o', iconsDir], {
    cwd: appDir,
    encoding: 'utf8',
    shell: false,
  });

  if (iconResult.status !== 0) {
    const details = [iconResult.stderr, iconResult.stdout].filter(Boolean).join('\n').trim();
    throw new Error(
      `Failed to generate Tauri icons.\n` +
        `Run manually from your project: npx tauri icon dist/app/src-tauri/icons/${destName}` +
        (details ? `\n\n${details}` : ''),
    );
  }

  const iconPng = path.join(iconsDir, 'icon.png');
  if (!fs.existsSync(iconPng)) {
    throw new Error(`Tauri icon generation did not produce icon.png at ${iconPng}`);
  }

  console.log(pc.green('Platform icons generated successfully'));
}

/**
 * Ensure Tauri bundle icons exist (defaults + optional regeneration from project icon).
 * @param {string} projectRoot
 * @param {string} appDir
 * @param {Object} config
 * @param {Record<string, any> | null} [projectTauriConf]
 */
export function ensureTauriIcons(projectRoot, appDir, config, projectTauriConf = null) {
  ensureDefaultTauriIcons(appDir);

  try {
    const sourceIconPath = resolveSourceIconPath(projectRoot, config, projectTauriConf);
    generateTauriIcons(projectRoot, appDir, sourceIconPath);
  } catch (error) {
    if (!fs.existsSync(path.join(appDir, 'src-tauri/icons/icon.png'))) {
      throw error;
    }
    console.warn(pc.yellow(`Using bundled default icons: ${error.message}`));
  }
}

/**
 * Sync shellui config values into app/src-tauri/tauri.conf.json
 * @param {string} root
 * @param {string} cwd
 * @param {{ host?: boolean; bundles?: string; config?: string }} [options]
 */
export async function syncTauriConfig(root, cwd, options = {}) {
  const projectRoot = getProjectRoot(root, cwd);
  const appDir = getDesktopAppDir(root, cwd);
  const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');

  if (!fs.existsSync(tauriConfPath)) {
    throw new Error(`Tauri config not found at ${tauriConfPath}`);
  }

  const config = await loadConfig(root, { config: options.config });
  const projectTauriConf = loadProjectTauriConf(projectRoot);
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

  const productName = resolveDefaultProductName(projectRoot, config);
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

  // Root tauri.conf.json wins for name / identifier / window / bundle extras.
  if (projectTauriConf) {
    mergeProjectTauriOverrides(tauriConf, projectTauriConf);
  }

  // Keep window title aligned with productName unless the root config set it explicitly.
  if (
    tauriConf.app?.windows?.[0] &&
    !(projectTauriConf?.app?.windows?.[0] && 'title' in projectTauriConf.app.windows[0])
  ) {
    tauriConf.app.windows[0].title = tauriConf.productName;
  }

  // macOS Dock / Cmd-Tab in `tauri dev` use the Cargo binary name, not productName.
  syncCargoPackageName(path.join(appDir, 'src-tauri'), tauriConf.productName);

  const port = config.port ?? 3000;
  tauriConf.build.devUrl = `http://localhost:${port}`;
  tauriConf.build.beforeDevCommand = {
    cwd: DESKTOP_HOOK_CWD,
    script: getShelluiHookCommand(projectRoot, appDir, 'start', options),
    wait: false,
  };
  tauriConf.build.beforeBuildCommand = {
    cwd: DESKTOP_HOOK_CWD,
    script: getShelluiHookCommand(projectRoot, appDir, 'build'),
  };
  tauriConf.build.frontendDist = DESKTOP_WEB_DIST;

  ensureTauriIcons(projectRoot, appDir, config, projectTauriConf);
  tauriConf.bundle = tauriConf.bundle || {};
  tauriConf.bundle.targets = options.bundles
    ? options.bundles
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : tauriConf.bundle.targets || ['app'];
  tauriConf.bundle.icon = [...TAURI_BUNDLE_ICONS];

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(pc.green(`Synced shellui config -> ${DESKTOP_APP_DIR}/`));
}

/**
 * Ensure the Tauri app folder exists and is up to date
 * @param {string} root
 * @param {string} cwd
 */
export async function ensureTauriApp(root, cwd) {
  const projectRoot = getProjectRoot(root, cwd);
  const appDir = getDesktopAppDir(root, cwd);
  const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');

  if (!fs.existsSync(tauriConfPath)) {
    scaffoldTauriApp(appDir);
  }

  await ensureTauriDeps(projectRoot);
}

/**
 * Run a Tauri CLI command from the app directory
 * @param {string} projectRoot
 * @param {string} appDir
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export function runTauriCommand(projectRoot, appDir, args) {
  const tauriCli = resolveTauriCli(projectRoot);

  return new Promise((resolve, reject) => {
    const proc = spawn(tauriCli, args, {
      cwd: appDir,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tauri ${args.join(' ')} exited with code ${code}`));
    });
  });
}

/**
 * Prepare and run Tauri dev
 * @param {string} root
 * @param {{ host?: boolean }} [options]
 */
export async function tauriDevCommand(root = '.', options = {}) {
  const cwd = process.cwd();
  await ensureTauriApp(root, cwd);
  await syncTauriConfig(root, cwd, options);

  const projectRoot = getProjectRoot(root, cwd);
  const appDir = getDesktopAppDir(root, cwd);

  console.log(pc.blue('Starting desktop development environment...'));
  await runTauriCommand(projectRoot, appDir, ['dev']);
}

/**
 * Prepare and run desktop app production build
 * @param {string} root
 * @param {{ bundles?: string }} [options]
 */
export async function tauriBuildCommand(root = '.', options = {}) {
  const cwd = process.cwd();
  await ensureTauriApp(root, cwd);
  await syncTauriConfig(root, cwd, options);

  const projectRoot = getProjectRoot(root, cwd);
  const appDir = getDesktopAppDir(root, cwd);
  const bundles = options.bundles || 'app';

  console.log(pc.blue('Building desktop app...'));
  await runTauriCommand(projectRoot, appDir, ['build', '--bundles', bundles]);
  console.log(
    pc.green(
      `Desktop build complete! Bundles are in ${path.join(DESKTOP_APP_DIR, 'src-tauri/target/release/bundle/')}`,
    ),
  );
  if (bundles === 'app' && process.platform === 'darwin') {
    console.log(
      pc.dim(
        'Built .app bundle only (no .dmg). For a DMG installer: shellui build --app --bundles app,dmg',
      ),
    );
  }
}
