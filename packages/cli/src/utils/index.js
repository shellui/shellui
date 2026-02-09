/**
 * Utilities index - Export all utility functions
 *
 * This is the main entry point for all utility functions.
 * Import from './utils/index.js' to get all utilities.
 */

export { resolvePackagePath, resolveSdkEntry } from './package-path.js';
export { loadConfig } from './config.js';
export {
  getCoreSrcPath,
  createResolveAlias,
  createPostCSSConfig,
  createViteDefine,
  createViteResolveConfig,
  createViteOptimizeDepsConfig,
  getDedupeList,
  getShelluiExcludePackages,
} from './vite.js';
