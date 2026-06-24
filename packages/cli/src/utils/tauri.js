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

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: 'shellui-app', private: true, version: '0.1.0' }, null, 2) + '\n',
    'utf-8',
  );
  console.log(pc.green(`Created ${packageJsonPath}`));
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
 * @param {string} projectRoot
 * @param {Object} config
 * @returns {string}
 */
export function resolveSourceIconPath(projectRoot, config) {
  if (config?.appIcon) {
    const appIconPath = path.join(projectRoot, config.appIcon.replace(/^\//, ''));
    if (fs.existsSync(appIconPath)) return appIconPath;
  }

  const faviconPath = path.join(projectRoot, 'static/favicon.svg');
  if (fs.existsSync(faviconPath)) return faviconPath;

  const defaultIcon = path.join(getTauriTemplateDir(), 'src-tauri/icons/icon.svg');
  if (fs.existsSync(defaultIcon)) return defaultIcon;

  throw new Error(
    'No icon source found for Tauri (add static/favicon.svg or appIcon in shellui.config.ts)',
  );
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
 */
export function ensureTauriIcons(projectRoot, appDir, config) {
  ensureDefaultTauriIcons(appDir);

  try {
    const sourceIconPath = resolveSourceIconPath(projectRoot, config);
    generateTauriIcons(projectRoot, appDir, sourceIconPath);
  } catch (error) {
    if (!fs.existsSync(path.join(appDir, 'src-tauri/icons/icon.png'))) {
      throw error;
    }
    console.warn(pc.yellow(`Using bundled default icons: ${error.message}`));
  }
}

/**
 * Sync shellui.config.ts values into app/src-tauri/tauri.conf.json
 * @param {string} root
 * @param {string} cwd
 * @param {{ host?: boolean; bundles?: string }} [options]
 */
export async function syncTauriConfig(root, cwd, options = {}) {
  const projectRoot = getProjectRoot(root, cwd);
  const appDir = getDesktopAppDir(root, cwd);
  const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');

  if (!fs.existsSync(tauriConfPath)) {
    throw new Error(`Tauri config not found at ${tauriConfPath}`);
  }

  const config = await loadConfig(root);
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

  const title = config.title || 'shellui';
  const identifier = `com.shellui.${title.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'app'}`;

  tauriConf.productName = title;
  tauriConf.identifier = identifier;
  if (tauriConf.app?.windows?.[0]) {
    tauriConf.app.windows[0].title = title;
  }

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

  ensureTauriIcons(projectRoot, appDir, config);
  tauriConf.bundle = tauriConf.bundle || {};
  tauriConf.bundle.targets = options.bundles
    ? options.bundles
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : ['app'];
  tauriConf.bundle.icon = [...TAURI_BUNDLE_ICONS];

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(pc.green(`Synced shellui.config.ts -> ${DESKTOP_APP_DIR}/`));
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
