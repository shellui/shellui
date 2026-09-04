import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import {
  CONFIG_SCHEMA_REF,
  MAIN_CONFIG_FILE,
  TS_CONFIG_FILE,
  resolveConfigLocation,
  getConfigPathOption,
} from '../utils/config-paths.js';

const SHELLUI_CONFIG_JSON = {
  $schema: CONFIG_SCHEMA_REF,
  port: 4000,
  title: 'My App',
  favicon: '/favicon.svg',
  logo: '/logo.svg',
  layout: 'sidebar',
  language: 'en',
  theme: 'shellui',
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: '/',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: '/__settings',
      openIn: 'modal',
      position: 'end',
    },
  ],
};

const GITIGNORE_DIST_ENTRY = 'dist/\n';

/**
 * Ensure dist/ is listed in .gitignore (web and desktop build output).
 * @param {string} projectDir
 */
function ensureDistGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (content.split('\n').some((line) => line.trim() === 'dist/' || line.trim() === 'dist')) {
      return;
    }
    fs.appendFileSync(gitignorePath, (content.endsWith('\n') ? '' : '\n') + GITIGNORE_DIST_ENTRY);
    return;
  }
  fs.writeFileSync(gitignorePath, GITIGNORE_DIST_ENTRY, 'utf-8');
}

/**
 * Init command - Creates a shellui.config.json boilerplate in the project
 * @param {string} root - Project root directory (default: current directory)
 * @param {{ force?: boolean, config?: string }} options - Optional flags
 */
export async function initCommand(root = '.', options = {}) {
  const location = resolveConfigLocation(root, getConfigPathOption(options));
  const { projectRoot, configDir, mainPath: configPath, tsPath } = location;

  if (fs.existsSync(configPath) && !options.force) {
    console.log(
      pc.yellow(`Config already exists at ${configPath}. Use ${pc.bold('--force')} to overwrite.`),
    );
    return;
  }

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, `${JSON.stringify(SHELLUI_CONFIG_JSON, null, 2)}\n`, 'utf-8');
    console.log(pc.green(`Created ${configPath}`));

    if (fs.existsSync(tsPath)) {
      console.log(
        pc.yellow(
          `Note: ${path.basename(tsPath)} is still present. JSON is preferred; run ${pc.bold('shellui config migrate')} or remove the TypeScript file. While both exist, JSON is loaded first.`,
        ),
      );
    }

    ensureDistGitignore(projectRoot);

    console.log(
      pc.dim(
        'Add a static/ folder with favicon.svg to customize assets. Run shellui dev to begin.',
      ),
    );
  } catch (err) {
    console.error(pc.red(`Failed to create config: ${err.message}`));
    throw err;
  }
}
