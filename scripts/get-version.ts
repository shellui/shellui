import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

/**
 * Determine if this is a build or dev mode.
 * Build: NODE_ENV=production or SHELLUI_BUILD=true.
 */
const isBuild = process.env.NODE_ENV === 'production' || process.env.SHELLUI_BUILD === 'true';

/**
 * Generate version string: base version, with -dev in dev or -<gitHash> in build.
 */
export function getVersion(): string {
  let version = packageJson.version;
  if (isBuild) {
    try {
      const gitHash = execSync('git rev-parse --short HEAD', {
        cwd: path.dirname(packageJsonPath),
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      version = `${packageJson.version}-${gitHash}`;
    } catch {
      version = packageJson.version;
    }
  } else {
    version = `${packageJson.version}-dev`;
  }
  return version;
}
