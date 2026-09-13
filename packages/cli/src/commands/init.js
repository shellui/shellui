import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { resolveConfigLocation, getConfigPathOption } from '../utils/config-paths.js';
import {
  getFramework,
  getFrameworkPromptOptions,
  getBackendPromptOptions,
} from '../init/registry.js';
import {
  parseInitArgs,
  applyInitDefaults,
  validateInitOptions,
  buildInitConfig,
} from '../init/build-config.js';
import { createEmptyShell, ensureDistGitignore } from '../init/scaffold.js';
import { resolveFrameworkTemplate } from '../init/templates.js';
import {
  detectPackageManager,
  formatInstallCommand,
  hasPackageJson,
  installDependencies,
} from '../init/package-manager.js';

/**
 * Check if stdin is a TTY (interactive terminal).
 */
function isInteractive() {
  return process.stdin.isTTY === true;
}

/**
 * cac maps `--no-install` to `install: false` (negated boolean).
 * @param {{ install?: boolean, noInstall?: boolean }} options
 * @returns {boolean}
 */
function shouldSkipInstall(options) {
  return options.install === false || options.noInstall === true;
}

/**
 * Init command - Creates a shellui project with interactive wizard or flags.
 * @param {string|undefined} frameworkOrRoot - Framework shortcut (react/vue/angular/empty) or root directory
 * @param {{
 *   force?: boolean,
 *   config?: string,
 *   framework?: string,
 *   backend?: string,
 *   companyId?: string | number,
 *   supabaseUrl?: string,
 *   install?: boolean,
 *   noInstall?: boolean,
 * }} options - Optional flags
 */
export async function initCommand(frameworkOrRoot, options = {}) {
  const { root, frameworkShortcut } = parseInitArgs(frameworkOrRoot);

  const location = resolveConfigLocation(root, getConfigPathOption(options));
  const { projectRoot, configDir, mainPath: configPath, tsPath } = location;

  if (fs.existsSync(configPath) && !options.force) {
    console.log(
      pc.yellow(`Config already exists at ${configPath}. Use ${pc.bold('--force')} to overwrite.`),
    );
    return;
  }

  let framework = frameworkShortcut || options.framework || null;
  let backend = options.backend || null;
  let companyId = options.companyId ?? null;
  let supabaseUrl = options.supabaseUrl ?? null;

  // Interactive wizard when no framework/backend flags and TTY is available
  if (!framework && !backend && isInteractive()) {
    p.intro(pc.bgCyan(pc.black(' shellui init ')));

    const frameworkAnswer = await p.select({
      message: 'Choose your framework',
      options: getFrameworkPromptOptions(),
    });

    if (p.isCancel(frameworkAnswer)) {
      p.cancel('Init cancelled');
      process.exit(0);
    }
    framework = frameworkAnswer;

    const backendAnswer = await p.select({
      message: 'Choose your backend',
      options: getBackendPromptOptions(),
    });

    if (p.isCancel(backendAnswer)) {
      p.cancel('Init cancelled');
      process.exit(0);
    }
    backend = backendAnswer;

    if (backend === 'shellui') {
      const companyIdAnswer = await p.text({
        message: 'Enter your Shellui company ID',
        placeholder: '123',
        validate: (value) => {
          if (!value || value.trim() === '') {
            return 'Company ID is required for Shellui backend';
          }
        },
      });

      if (p.isCancel(companyIdAnswer)) {
        p.cancel('Init cancelled');
        process.exit(0);
      }
      companyId = companyIdAnswer;
    } else if (backend === 'supabase') {
      const supabaseUrlAnswer = await p.text({
        message: 'Enter your Supabase project URL',
        placeholder: 'https://xxxxx.supabase.co',
        validate: (value) => {
          if (!value || value.trim() === '') {
            return 'Supabase URL is required';
          }
          if (!value.startsWith('http://') && !value.startsWith('https://')) {
            return 'URL must start with http:// or https://';
          }
        },
      });

      if (p.isCancel(supabaseUrlAnswer)) {
        p.cancel('Init cancelled');
        process.exit(0);
      }
      supabaseUrl = supabaseUrlAnswer;
    }
  } else {
    ({ framework, backend } = applyInitDefaults({ framework, backend }));
  }

  try {
    validateInitOptions({ framework, backend, companyId, supabaseUrl });
  } catch (err) {
    console.error(pc.red(`Error: ${err.message}`));
    process.exit(1);
    return;
  }

  const s = p.spinner();
  s.start('Creating project...');

  /** @type {string | null} */
  let installCommand = null;
  /** @type {'ok' | 'failed' | 'skipped' | 'instructions' | null} */
  let installStatus = null;

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Scaffold first so package.json / lockfiles exist for package-manager detection.
    const frameworkDef = getFramework(framework);
    if (frameworkDef?.scaffold === 'empty' || frameworkDef?.scaffold === 'skip') {
      const { created } = createEmptyShell(projectRoot);
      if (created) {
        console.log(pc.green('Created static/ folder with placeholder assets'));
      }
    } else if (frameworkDef?.scaffold === 'fetch') {
      try {
        const pkg = await import('../../package.json', { with: { type: 'json' } });
        const cliVersion = pkg.default.version;
        await resolveFrameworkTemplate(framework, projectRoot, cliVersion, {
          onInfo: (msg) => console.log(pc.dim(msg)),
        });
      } catch (fetchErr) {
        s.stop(pc.yellow(`Could not fetch ${framework} template`));
        console.error(pc.yellow(fetchErr.message));
        console.log(pc.dim('Creating empty shell instead...'));
        createEmptyShell(projectRoot);
      }
    }

    ensureDistGitignore(projectRoot);

    const packageManager = hasPackageJson(projectRoot) ? detectPackageManager(projectRoot) : null;

    const config = buildInitConfig({
      framework,
      backend,
      companyId,
      supabaseUrl,
      packageManager,
    });
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

    if (fs.existsSync(tsPath)) {
      console.log(
        pc.yellow(
          `Note: ${path.basename(tsPath)} is still present. JSON is preferred; run ${pc.bold('shellui config migrate')} or remove the TypeScript file. While both exist, JSON is loaded first.`,
        ),
      );
    }

    s.stop(pc.green('Project created!'));

    // Post-init dependency install for frameworks with package.json.
    // Empty / other (no package.json): skip quietly.
    if (hasPackageJson(projectRoot)) {
      if (shouldSkipInstall(options)) {
        installStatus = 'skipped';
        if (packageManager) {
          installCommand = formatInstallCommand(packageManager);
        }
      } else if (packageManager) {
        installCommand = formatInstallCommand(packageManager);
        const installSpinner = p.spinner();
        if (isInteractive()) {
          installSpinner.start(`Running ${installCommand}...`);
        } else {
          console.log(pc.dim(`Running ${installCommand}...`));
        }

        try {
          await installDependencies(projectRoot, packageManager);
          installStatus = 'ok';
          if (isInteractive()) {
            installSpinner.stop(pc.green(`Ran ${installCommand}`));
          } else {
            console.log(pc.green(`Ran ${installCommand}`));
          }
        } catch (installErr) {
          installStatus = 'failed';
          if (isInteractive()) {
            installSpinner.stop(pc.yellow(`Could not run ${installCommand}`));
          }
          console.log(
            pc.yellow(
              `Warning: dependency install failed (${installErr.message}). Project was still created.`,
            ),
          );
          console.log(
            pc.dim(`Run ${pc.cyan(installCommand)} manually, then ${pc.cyan('shellui start')}.`),
          );
        }
      } else {
        // No usable package manager — do not fail init; print instructions.
        installStatus = 'instructions';
        console.log(
          pc.yellow(
            'Dependencies were not installed (no package manager detected). Run npm install (or pnpm / yarn), then shellui start.',
          ),
        );
      }
    }

    if (isInteractive()) {
      const parts = [`${pc.green('✓')} Project ready`];
      if (installStatus === 'ok' && installCommand) {
        parts.push(`Ran ${pc.cyan(installCommand)}`);
      } else if (installStatus === 'skipped' && installCommand) {
        parts.push(`Skipped install — run ${pc.cyan(installCommand)} when ready`);
      } else if (installStatus === 'failed' && installCommand) {
        parts.push(`Install manually with ${pc.cyan(installCommand)}`);
      } else if (installStatus === 'instructions') {
        parts.push('Install dependencies, then continue');
      }
      parts.push(`Next: ${pc.cyan('shellui start')}`);
      p.outro(parts.join('\n'));
    } else {
      console.log(pc.green(`Created ${configPath}`));
      if (installStatus === 'ok' && installCommand) {
        console.log(pc.dim(`Ran ${pc.cyan(installCommand)}`));
      } else if (installStatus === 'skipped' && installCommand) {
        console.log(
          pc.dim(
            `Skipped install (${pc.cyan('--no-install')}). Run ${pc.cyan(installCommand)} when ready.`,
          ),
        );
      }
      console.log(pc.dim(`Run ${pc.cyan('shellui start')} to begin development`));
    }
  } catch (err) {
    s.stop(pc.red('Failed to create project'));
    console.error(pc.red(`Error: ${err.message}`));
    throw err;
  }
}

// Re-export pure helpers for tests / advanced callers
export {
  parseInitArgs,
  applyInitDefaults,
  validateInitOptions,
  buildInitConfig,
  buildBaseConfig,
  applyBackendConfig,
  normalizeCompanyId,
} from '../init/build-config.js';
export {
  FRAMEWORKS,
  BACKENDS,
  getFramework,
  getBackend,
  getPositionalFrameworkIds,
} from '../init/registry.js';
export { resolveFrameworkTemplate, resolveLocalTemplatePath } from '../init/templates.js';
export { createEmptyShell, ensureDistGitignore } from '../init/scaffold.js';
export {
  detectPackageManager,
  formatDevRun,
  formatInstallCommand,
  installDependencies,
} from '../init/package-manager.js';
