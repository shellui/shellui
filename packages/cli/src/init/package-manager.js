import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

/** @typedef {'pnpm' | 'yarn' | 'npm' | 'bun'} PackageManager */

/** Known package managers, in PATH preference order when no lockfile / field is present. */
const PATH_PREFERENCE = /** @type {const} */ (['pnpm', 'yarn', 'npm']);

/** Lockfile → package manager (checked in this order). */
const LOCKFILE_MANAGERS = /** @type {const} */ ([
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
]);

/**
 * @param {string} command
 * @returns {boolean}
 */
export function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [command], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Parse Corepack-style `packageManager` field (e.g. `pnpm@9.15.0` → `pnpm`).
 * @param {unknown} field
 * @returns {PackageManager | null}
 */
export function parsePackageManagerField(field) {
  if (typeof field !== 'string' || field.trim() === '') return null;
  const name = field.split('@')[0].trim().toLowerCase();
  if (name === 'pnpm' || name === 'yarn' || name === 'npm' || name === 'bun') {
    return name;
  }
  return null;
}

/**
 * Detect which package manager to use for a project.
 *
 * Order (keep in sync with comments / tests):
 * 1. `packageManager` field in package.json (Corepack style, e.g. `pnpm@9...` → pnpm)
 * 2. Lockfiles in the project root: pnpm-lock.yaml → pnpm, yarn.lock → yarn,
 *    package-lock.json → npm, bun.lockb / bun.lock → bun
 * 3. First binary on PATH among: pnpm, yarn, npm (npm last as universal fallback)
 * 4. null if nothing usable — caller should print install instructions, not fail init
 *
 * @param {string} projectRoot
 * @param {{ commandExists?: (cmd: string) => boolean }} [opts]
 * @returns {PackageManager | null}
 */
export function detectPackageManager(projectRoot, opts = {}) {
  const exists = opts.commandExists ?? commandExists;

  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const fromField = parsePackageManagerField(pkg.packageManager);
      if (fromField) return fromField;
    } catch {
      // Ignore invalid package.json; fall through to lockfiles / PATH.
    }
  }

  for (const [lockfile, manager] of LOCKFILE_MANAGERS) {
    if (fs.existsSync(path.join(projectRoot, lockfile))) {
      return manager;
    }
  }

  for (const manager of PATH_PREFERENCE) {
    if (exists(manager)) return manager;
  }

  return null;
}

/**
 * Build the companion `dev.run` command for a detected package manager.
 * @param {PackageManager | string} packageManager
 * @param {string} [script='dev']
 * @returns {string}
 */
export function formatDevRun(packageManager, script = 'dev') {
  return `${packageManager} run ${script}`;
}

/**
 * Install command shown to users / run by init (e.g. `pnpm install`).
 * @param {PackageManager | string} packageManager
 * @returns {string}
 */
export function formatInstallCommand(packageManager) {
  return `${packageManager} install`;
}

/**
 * Whether the project root has a package.json (framework scaffolds do; empty does not).
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function hasPackageJson(projectRoot) {
  return fs.existsSync(path.join(projectRoot, 'package.json'));
}

/**
 * Run `{packageManager} install` in projectRoot.
 * @param {string} projectRoot
 * @param {PackageManager | string} packageManager
 * @returns {Promise<void>}
 */
export function installDependencies(projectRoot, packageManager) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, ['install'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: process.env,
    });

    let stderr = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim();
      reject(
        new Error(
          detail
            ? `${formatInstallCommand(packageManager)} failed: ${detail}`
            : `${formatInstallCommand(packageManager)} failed with exit code ${code}`,
        ),
      );
    });
  });
}
