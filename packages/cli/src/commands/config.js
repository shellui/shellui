import path from 'path';
import pc from 'picocolors';
import { splitConfig, unsplitConfig } from '../utils/config-split.js';
import { migrateTsConfig } from '../utils/migrate-config.js';

/**
 * Config subcommands: migrate | split | unsplit
 * @param {string} action
 * @param {string} root
 */
export async function configCommand(action, root = '.') {
  const cwd = process.cwd();
  const configDir = path.resolve(cwd, root);
  const normalized = String(action || '')
    .trim()
    .toLowerCase();

  try {
    if (normalized === 'migrate') {
      const { jsonPath, backupPath } = await migrateTsConfig(configDir);
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
      const { written, removed } = splitConfig(configDir);
      console.log(pc.green(`Split ${removed} into:`));
      for (const file of written) {
        console.log(pc.dim(`  - ${file}`));
      }
      return;
    }

    if (normalized === 'unsplit') {
      const { written, removed } = unsplitConfig(configDir);
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
