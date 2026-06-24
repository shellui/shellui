import path from 'path';

/** Root output folder for all ShellUI build artifacts */
export const DIST_DIR = 'dist';

/** Web build output (static site) */
export const WEB_DIST_DIR = path.join(DIST_DIR, 'web');

/** Generated desktop app wrapper (Tauri today; swappable implementation) */
export const DESKTOP_APP_DIR = path.join(DIST_DIR, 'app');

/** @deprecated Use DESKTOP_APP_DIR */
export const TAURI_APP_DIR = DESKTOP_APP_DIR;

/**
 * Resolve the project root directory
 * @param {string} root
 * @param {string} cwd
 * @returns {string}
 */
export function getProjectRoot(root, cwd) {
  return path.resolve(cwd, root);
}

/**
 * Resolve the web build output directory (<project>/dist/web)
 * @param {string} root
 * @param {string} cwd
 * @returns {string}
 */
export function getWebDistDir(root, cwd) {
  return path.join(getProjectRoot(root, cwd), WEB_DIST_DIR);
}

/**
 * Resolve the generated desktop app directory (<project>/dist/app)
 * @param {string} root
 * @param {string} cwd
 * @returns {string}
 */
export function getDesktopAppDir(root, cwd) {
  return path.join(getProjectRoot(root, cwd), DESKTOP_APP_DIR);
}

/** @deprecated Use getDesktopAppDir */
export function getAppDir(root, cwd) {
  return getDesktopAppDir(root, cwd);
}

/**
 * Relative path from desktop src-tauri to project root (for Tauri hook cwd)
 */
export const DESKTOP_HOOK_CWD = '../../..';

/**
 * Relative path from desktop src-tauri to web build output (for Tauri frontendDist)
 */
export const DESKTOP_WEB_DIST = '../../web';
