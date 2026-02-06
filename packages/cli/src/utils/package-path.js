import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Resolve the path to a package in the monorepo or node_modules
 * Works in both workspace mode (monorepo) and npm-installed mode
 * @param {string} packageName - The name of the package
 * @returns {string} The absolute path to the package
 */
export function resolvePackagePath(packageName) {
  try {
    // Try to resolve the package using require.resolve
    // This works for both workspace packages (via pnpm workspace) and npm-installed packages
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    const resolved = path.dirname(packageJsonPath);
    
    // Resolve symlinks to get the canonical path — pnpm uses symlinks that
    // point to different .pnpm/ directories; Vite resolves real paths so we
    // need to be consistent to avoid mismatched root vs input paths.
    try {
      return fs.realpathSync(resolved);
    } catch {
      return resolved;
    }
  } catch (e) {
    // Fallback: assume workspace structure (for development in monorepo)
    // Go up from cli/src/utils/package-path.js -> cli/src/utils -> cli/src -> cli -> packages -> packageName
    const packagesDir = path.resolve(__dirname, '../../../');
    const resolved = path.join(packagesDir, packageName.replace('@shellui/', ''));
    
    // Only use this fallback if the path exists (workspace mode)
    if (fs.existsSync(resolved)) {
      try {
        return fs.realpathSync(resolved);
      } catch {
        return resolved;
      }
    }
    
    // If we get here, the package wasn't found
    throw new Error(
      `Package "${packageName}" not found. ` +
      `Make sure it's installed (npm/pnpm install) or available in the workspace. ` +
      `Original error: ${e.message}`
    );
  }
}

/**
 * Resolve the @shellui/sdk entry point for Vite alias.
 * In workspace/monorepo mode, returns the source path (src/index.ts) so Vite
 * can process TypeScript directly without a pre-build step.
 * When installed from npm (no source), returns null so Vite uses normal
 * node_modules resolution (dist/index.js via package exports).
 * @returns {string|null} Absolute path to SDK source entry, or null to use normal resolution
 */
export function resolveSdkEntry() {
  const sdkPackagePath = resolvePackagePath('@shellui/sdk');
  const srcEntry = path.join(sdkPackagePath, 'src', 'index.ts');

  // In workspace mode, source is available — alias to it for a no-build dev flow
  if (fs.existsSync(srcEntry)) {
    return srcEntry;
  }

  // When installed from npm only dist/ exists — let Vite resolve through package exports
  return null;
}
