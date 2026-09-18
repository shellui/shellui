import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

/**
 * @param {string} p
 */
function realPathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * @param {string} parent
 * @param {string} child
 */
function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Assess whether a config directory/file is on a trusted path.
 *
 * TypeScript configs execute arbitrary code via `tsx`; JSON from world-writable
 * or symlink-escaped paths can also be dangerous. See docs/cli.md#trusted-config-paths.
 *
 * @param {{
 *   projectRoot: string,
 *   configDir: string,
 *   configPath?: string,
 *   isTypeScript?: boolean,
 * }} opts
 * @returns {string[]} Non-fatal warnings
 */
export function checkConfigPathTrust({ projectRoot, configDir, configPath, isTypeScript = false }) {
  const warnings = [];
  const projectReal = realPathSafe(projectRoot);
  const configDirReal = realPathSafe(configDir);

  if (!isPathInside(projectReal, configDirReal)) {
    warnings.push(
      `Config directory ${configDir} is outside project root ${projectRoot}. ` +
        'Shellui config influences dev tooling and may execute TypeScript — load only from trusted paths.',
    );
  }

  const statTargets = [];
  if (configPath && fs.existsSync(configPath)) {
    statTargets.push({ label: configPath, kind: 'file' });
  } else if (fs.existsSync(configDir)) {
    statTargets.push({ label: configDir, kind: 'directory' });
  }

  for (const { label, kind } of statTargets) {
    const targetReal = realPathSafe(label);

    if (kind === 'file' && !isPathInside(projectReal, targetReal)) {
      const err = new Error(
        `Config path ${label} resolves outside project root (${targetReal}). Refusing to load.`,
      );
      err.code = 'CONFIG_UNTRUSTED_PATH';
      throw err;
    }

    if (process.platform !== 'win32') {
      const mode = fs.statSync(label).mode & 0o777;
      if (mode & 0o002) {
        const err = new Error(`Config path is world-writable: ${label}. Refusing to load.`);
        err.code = 'CONFIG_UNTRUSTED_PATH';
        throw err;
      }
      if (mode & 0o020) {
        warnings.push(
          `Config path ${label} is group-writable. Ensure only trusted users can modify Shellui config.`,
        );
      }
    }
  }

  if (isTypeScript) {
    warnings.push(
      'TypeScript config executes with CLI privileges. Prefer JSON (`shellui config migrate`) for CI-safe configs.',
    );
  }

  return warnings;
}

/**
 * @param {string[]} warnings
 */
export function emitConfigPathWarnings(warnings) {
  for (const message of warnings) {
    console.warn(pc.yellow(message));
  }
}
