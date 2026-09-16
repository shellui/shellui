import path from 'path';
import pc from 'picocolors';
import { splitConfig, unsplitConfig } from '../utils/config-split.js';
import { migrateTsConfig } from '../utils/migrate-config.js';
import { resolveConfigLocation, getConfigPathOption } from '../utils/config-paths.js';

/**
 * Config subcommands: migrate | split | unsplit
 * @param {string} action
 * @param {string} root
 * @param {{ config?: string }} [options]
 */
export async function configCommand(action, root = '.', options = {}) {
  const location = resolveConfigLocation(root, getConfigPathOption(options));
  const { configDir, mainPath, tsPath } = location;
  const normalized = String(action || '')
    .trim()
    .toLowerCase();

  try {
    if (normalized === 'migrate') {
      const { jsonPath, backupPath } = await migrateTsConfig(configDir, {
        tsPath,
        jsonPath: mainPath,
      });
      console.log(pc.green(`Migrated TypeScript config to ${jsonPath}`));
      console.log(pc.dim(`Original saved as ${backupPath}`));
      console.log(
        pc.dim(
          'Values were taken from the evaluated TypeScript export (env, files, and computed fields are baked into the JSON). Review the file, then remove the .bak when ready. Use `shellui config split` to split into focused files.',
        ),
      );
      return;
    }

    if (normalized === 'split') {
      const { written, removed } = splitConfig(configDir, { mainPath });
      console.log(pc.green(`Split ${removed} into:`));
      for (const file of written) {
        console.log(pc.dim(`  - ${file}`));
      }
      return;
    }

    if (normalized === 'unsplit') {
      const { written, removed } = unsplitConfig(configDir, { mainPath });
      console.log(pc.green(`Merged split configs into ${written}`));
      for (const file of removed) {
        console.log(pc.dim(`  removed ${file}`));
      }
      return;
    }

    console.error(
      pc.red(
        `Unknown config action "${action}". Use ${pc.bold('shellui config migrate')}, ${pc.bold('shellui config split')}, or ${pc.bold('shellui config unsplit')}.`,
      ),
    );
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(err.message));
    process.exitCode = 1;
  }
}
