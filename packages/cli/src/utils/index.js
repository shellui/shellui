/**
 * Utilities index - Export all utility functions
 *
 * This is the main entry point for all utility functions.
 * Import from './utils/index.js' to get all utilities.
 */

export { resolvePackagePath, resolveSdkEntry } from './package-path.js';
export { loadConfig } from './config.js';
export {
  DIST_DIR,
  WEB_DIST_DIR,
  DESKTOP_APP_DIR,
  TAURI_APP_DIR,
  getProjectRoot,
  getWebDistDir,
  getDesktopAppDir,
  getAppDir,
  DESKTOP_HOOK_CWD,
  DESKTOP_WEB_DIST,
} from './paths.js';
export {
  getCoreSrcPath,
  createResolveAlias,
  createPostCSSConfig,
  createShelluiConfigPlugin,
  getShelluiConfigAlias,
  createViteResolveConfig,
  getShelluiTargetDefine,
  resolveShelluiTarget,
} from './vite.js';
export {
  getTauriTemplateDir,
  detectPackageManager,
  ensureTauriDeps,
  scaffoldTauriApp,
  getShelluiHookCommand,
  resolveTauriCli,
  syncTauriConfig,
  ensureTauriApp,
  runTauriCommand,
  tauriDevCommand,
  tauriBuildCommand,
  TAURI_BUNDLE_ICONS,
  resolveSourceIconPath,
  ensureDefaultTauriIcons,
  generateTauriIcons,
  ensureTauriIcons,
} from './tauri.js';
