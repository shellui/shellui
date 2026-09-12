import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import {
  CONFIG_SCHEMA_REF,
  MAIN_CONFIG_FILE,
  TS_CONFIG_FILE,
  resolveConfigLocation,
  getConfigPathOption,
} from '../utils/config-paths.js';

const FRAMEWORK_OPTIONS = [
  { value: 'empty', label: 'Empty shell (no framework)', hint: 'Minimal config + static stubs' },
  { value: 'react', label: 'React (Vite + React)', hint: 'Full React starter with SDK' },
  { value: 'vue', label: 'Vue (Vite + Vue)', hint: 'Full Vue starter with SDK' },
  { value: 'angular', label: 'Angular', hint: 'Full Angular starter with SDK' },
  { value: 'other', label: 'Other (coming soon)', hint: 'Skip scaffold' },
];

const BACKEND_OPTIONS = [
  { value: 'none', label: 'No backend (frontend only)', hint: 'No auth/API integration' },
  { value: 'shellui', label: 'Shellui', hint: 'Official Shellui backend' },
  { value: 'supabase', label: 'Supabase', hint: 'Open source Firebase alternative' },
];

function getBaseConfig() {
  return {
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
}

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
 * Fetch a template from GitHub for the given framework
 * @param {string} framework - Framework name (react, vue, angular)
 * @param {string} targetDir - Target directory to extract template to
 * @param {string} cliVersion - CLI version for tag-based fetching
 */
async function fetchTemplate(framework, targetDir, cliVersion) {
  // For development: check if we're in the monorepo and can copy locally
  const localTemplatePath = path.join(process.cwd(), 'packages/cli/templates', framework);
  if (fs.existsSync(localTemplatePath)) {
    console.log(pc.dim(`Using local template: ${localTemplatePath}`));
    copyDir(localTemplatePath, targetDir);
    return true;
  }

  // Try fetching from GitHub release tag
  const tagName = `v${cliVersion}`;
  const baseUrl = `https://raw.githubusercontent.com/shellui/shellui/${tagName}/packages/cli/templates/${framework}`;

  console.log(pc.dim(`Fetching ${framework} template from GitHub (${tagName})...`));

  try {
    // Fetch a manifest or key file to check if the template exists
    const manifestUrl = `${baseUrl}/package.json`;
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      // Fall back to main branch if tag doesn't exist yet
      console.log(pc.dim(`Tag ${tagName} not found, trying main branch...`));
      const mainBaseUrl = `https://raw.githubusercontent.com/shellui/shellui/main/packages/cli/templates/${framework}`;
      return await fetchTemplateFiles(mainBaseUrl, targetDir, framework);
    }

    return await fetchTemplateFiles(baseUrl, targetDir, framework);
  } catch (err) {
    console.error(pc.yellow(`Failed to fetch template: ${err.message}`));
    return false;
  }
}

/**
 * Fetch template files from GitHub
 * @param {string} baseUrl - Base URL for the template
 * @param {string} targetDir - Target directory
 * @param {string} framework - Framework name
 */
async function fetchTemplateFiles(baseUrl, targetDir, framework) {
  // Define the files we need to fetch for each framework
  const templateFiles = {
    react: [
      'package.json',
      'index.html',
      'vite.config.js',
      'src/main.jsx',
      'src/App.jsx',
      'src/App.css',
      'static/favicon.svg',
      'static/logo.svg',
    ],
    vue: [
      'package.json',
      'index.html',
      'vite.config.js',
      'src/main.js',
      'src/App.vue',
      'static/favicon.svg',
      'static/logo.svg',
    ],
    angular: [
      'package.json',
      'angular.json',
      'tsconfig.json',
      'tsconfig.app.json',
      'src/main.ts',
      'src/app/app.component.ts',
      'src/app/app.component.html',
      'src/index.html',
      'static/favicon.svg',
      'static/logo.svg',
    ],
  };

  const files = templateFiles[framework] || [];

  for (const file of files) {
    try {
      const fileUrl = `${baseUrl}/${file}`;
      const response = await fetch(fileUrl);
      if (response.ok) {
        const content = await response.text();
        const targetPath = path.join(targetDir, file);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf-8');
      }
    } catch (err) {
      console.log(pc.dim(`Skipping ${file}: ${err.message}`));
    }
  }

  return true;
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create empty shell scaffold with minimal static files
 * @param {string} projectRoot - Project root directory
 */
function createEmptyShell(projectRoot) {
  const staticDir = path.join(projectRoot, 'static');
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });

    // Create a simple SVG favicon
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🐚</text></svg>`;
    fs.writeFileSync(path.join(staticDir, 'favicon.svg'), faviconSvg, 'utf-8');

    // Create a simple logo
    const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><text y="35" font-size="30" fill="currentColor">My App</text></svg>`;
    fs.writeFileSync(path.join(staticDir, 'logo.svg'), logoSvg, 'utf-8');

    console.log(pc.green('Created static/ folder with placeholder assets'));
  }
}

/**
 * Check if stdin is a TTY (interactive terminal)
 */
function isInteractive() {
  return process.stdin.isTTY === true;
}

/**
 * Init command - Creates a shellui project with interactive wizard or flags
 * @param {string|undefined} frameworkOrRoot - Framework shortcut (react/vue/angular) or root directory
 * @param {{
 *   force?: boolean,
 *   config?: string,
 *   framework?: string,
 *   backend?: string,
 *   companyId?: string | number,
 *   supabaseUrl?: string
 * }} options - Optional flags
 */
export async function initCommand(frameworkOrRoot, options = {}) {
  // Parse arguments: support both `shellui init react` and `shellui init ./my-project --framework react`
  let root = '.';
  let frameworkShortcut = null;

  if (frameworkOrRoot && ['react', 'vue', 'angular', 'empty'].includes(frameworkOrRoot)) {
    // First arg is a framework shortcut
    frameworkShortcut = frameworkOrRoot;
  } else if (frameworkOrRoot) {
    // First arg is a root directory
    root = frameworkOrRoot;
  }

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
  let companyId = options.companyId || null;
  let supabaseUrl = options.supabaseUrl || null;

  // Interactive wizard if no flags provided and TTY is available
  if (!framework && !backend && isInteractive()) {
    p.intro(pc.bgCyan(pc.black(' shellui init ')));

    // Framework selection
    const frameworkAnswer = await p.select({
      message: 'Choose your framework',
      options: FRAMEWORK_OPTIONS,
    });

    if (p.isCancel(frameworkAnswer)) {
      p.cancel('Init cancelled');
      process.exit(0);
    }

    framework = frameworkAnswer;

    // Backend selection
    const backendAnswer = await p.select({
      message: 'Choose your backend',
      options: BACKEND_OPTIONS,
    });

    if (p.isCancel(backendAnswer)) {
      p.cancel('Init cancelled');
      process.exit(0);
    }

    backend = backendAnswer;

    // Backend-specific prompts
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
  } else if (!framework || !backend) {
    // Non-interactive: default to empty shell and no backend if not specified
    framework = framework || 'empty';
    backend = backend || 'none';
  }

  // Validate backend-specific required options in non-interactive mode
  if (backend === 'shellui' && !companyId) {
    console.error(pc.red('Error: --company-id is required when using --backend shellui'));
    process.exit(1);
  }

  if (backend === 'supabase' && !supabaseUrl) {
    console.error(pc.red('Error: --supabase-url is required when using --backend supabase'));
    process.exit(1);
  }

  // Show spinner for non-interactive or after prompts
  const s = p.spinner();
  s.start('Creating project...');

  try {
    // Create config directory
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Build config object
    const config = getBaseConfig();

    // Add backend config if needed
    if (backend === 'shellui') {
      config.backend = {
        type: 'shellui',
        url: 'https://id.shellui.com',
        companyId: isNaN(companyId) ? companyId : parseInt(companyId, 10),
        login: {
          methods: ['password', 'oauth'],
        },
      };
    } else if (backend === 'supabase') {
      config.backend = {
        type: 'supabase',
        url: supabaseUrl,
      };
    }

    // Write config file
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

    // Handle framework scaffolding
    if (framework === 'empty' || framework === 'other') {
      createEmptyShell(projectRoot);
    } else if (['react', 'vue', 'angular'].includes(framework)) {
      // Try to fetch/copy template
      const pkg = await import('../../package.json', { with: { type: 'json' } });
      const cliVersion = pkg.default.version;
      const success = await fetchTemplate(framework, projectRoot, cliVersion);

      if (!success) {
        s.stop(pc.yellow(`Could not fetch ${framework} template`));
        console.log(pc.dim('Creating empty shell instead...'));
        createEmptyShell(projectRoot);
      }
    }

    ensureDistGitignore(projectRoot);

    if (fs.existsSync(tsPath)) {
      console.log(
        pc.yellow(
          `Note: ${path.basename(tsPath)} is still present. JSON is preferred; run ${pc.bold('shellui config migrate')} or remove the TypeScript file. While both exist, JSON is loaded first.`,
        ),
      );
    }

    s.stop(pc.green('Project created!'));

    if (isInteractive()) {
      p.outro(`${pc.green('✓')} Run ${pc.cyan('shellui start')} to begin development`);
    } else {
      console.log(pc.green(`Created ${configPath}`));
      console.log(pc.dim(`Run ${pc.cyan('shellui start')} to begin development`));
    }
  } catch (err) {
    s.stop(pc.red('Failed to create project'));
    console.error(pc.red(`Error: ${err.message}`));
    throw err;
  }
}
