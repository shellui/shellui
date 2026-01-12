import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Resolve the path to a package in the monorepo
 * @param {string} packageName - The name of the package
 * @returns {string} The absolute path to the package
 */
export function resolvePackagePath(packageName) {
  try {
    // Try to resolve the package using require.resolve
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    return path.dirname(packageJsonPath);
  } catch (e) {
    // Fallback: assume workspace structure
    // Go up from cli/src/utils/package-path.js -> cli/src/utils -> cli/src -> cli -> packages -> packageName
    const packagesDir = path.resolve(__dirname, '../../../');
    return path.join(packagesDir, packageName.replace('@shellui/', ''));
  }
}
