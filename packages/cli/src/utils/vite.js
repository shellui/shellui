import path from 'path';
import fs from 'fs';
import tailwindcssPlugin from '@tailwindcss/postcss';
import autoprefixerPlugin from 'autoprefixer';
import { resolvePackagePath, resolveSdkEntry } from './index.js';

/**
 * Get the path to the core package source directory
 * Works in both workspace mode (monorepo) and npm-installed mode
 * @returns {string} Absolute path to core package src directory
 */
export function getCoreSrcPath() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  const srcPath = path.join(corePackagePath, 'src');

  // Verify src directory exists (should always exist since it's in package.json files)
  if (!fs.existsSync(srcPath)) {
    throw new Error(
      `Core package src directory not found at ${srcPath}. ` +
        `Make sure @shellui/core is properly installed and includes the src directory.`,
    );
  }

  // Verify index.html exists (required for dev server)
  const indexHtmlPath = path.join(srcPath, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(
      `Core package index.html not found at ${indexHtmlPath}. ` +
        `Make sure @shellui/core is properly installed.`,
    );
  }

  return srcPath;
}

const SHELLUI_CONFIG_VIRTUAL_ID = 'virtual:shellui-config';
const SHELLUI_CONFIG_ALIAS_ID = '\0' + SHELLUI_CONFIG_VIRTUAL_ID;

function flattenNav(nav) {
  if (!nav?.length) return [];
  return nav.flatMap((item) => (item.items ? item.items : [item]));
}

/**
 * Create Vite plugin that provides the ShellUI config as a virtual module.
 * When projectRoot is set and nav items have componentPath, those components are imported and exported as shelluiComponents for /__app/:path routes.
 * @param {Object} config - Loaded shellui config (will be serialized for the virtual module)
 * @param {{ projectRoot?: string }} options - Optional. projectRoot: absolute path to the project (for resolving componentPath).
 * @returns {import('vite').Plugin}
 */
export function createShelluiConfigPlugin(config, options = {}) {
  const serializableConfig = JSON.parse(JSON.stringify(config));
  const projectRoot = options.projectRoot;
  const items = flattenNav(serializableConfig.navigation);
  const importLines = [];
  const componentEntries = [];
  items.forEach((item, index) => {
    const cp = item.componentPath;
    if (!cp || typeof cp !== 'string') return;
    const key = item.path === '' || item.path === '/' ? 'home' : item.path;
    const absPath = path.isAbsolute(cp) ? cp : (projectRoot ? path.join(projectRoot, cp) : null);
    if (!absPath) return;
    const importPath = absPath.replace(/\\/g, '/');
    const varName = `__ShellUIComponent_${index}`;
    const exportName = item.componentExportName;
    if (exportName) {
      importLines.push(`import { ${exportName} as ${varName} } from ${JSON.stringify(importPath)};`);
    } else {
      importLines.push(`import ${varName} from ${JSON.stringify(importPath)};`);
    }
    componentEntries.push(`${JSON.stringify(key)}: ${varName}`);
  });

  const componentsBlock =
    componentEntries.length > 0
      ? `\nexport const shelluiComponents = { ${componentEntries.join(', ')} };\n`
      : '\nexport const shelluiComponents = {};\n';

  const moduleContent =
    (importLines.length > 0 ? importLines.join('\n') + '\n' : '') +
    `export const shelluiConfig = ${JSON.stringify(serializableConfig)};${componentsBlock}export default shelluiConfig;
`;

  return {
    name: 'shellui-config',
    resolveId(id) {
      if (id === SHELLUI_CONFIG_VIRTUAL_ID) {
        return SHELLUI_CONFIG_ALIAS_ID;
      }
      return null;
    },
    load(id) {
      if (id === SHELLUI_CONFIG_ALIAS_ID) {
        return moduleContent;
      }
      return null;
    },
  };
}

/**
 * Resolve alias for ShellUI config. Use together with createShelluiConfigPlugin so that
 * imports like "import shelluiConfig from '@shellui/config'" resolve to the virtual module.
 * @returns {Object} Vite resolve.alias entry for @shellui/config
 */
export function getShelluiConfigAlias() {
  return {
    '@shellui/config': SHELLUI_CONFIG_VIRTUAL_ID,
  };
}

/**
 * Create Vite resolve.alias configuration.
 * Sets '@shellui/sdk' to source entry when in workspace mode; omits the alias
 * when installed from npm so Vite resolves through the package's exports field (dist/index.js).
 * @returns {Object} Vite resolve.alias object
 */
export function createResolveAlias() {
  const sdkEntry = resolveSdkEntry();

  const alias = {};

  if (sdkEntry) {
    alias['@shellui/sdk'] = sdkEntry;
  }

  return alias;
}

/**
 * Create PostCSS configuration for Vite.
 * Provides Tailwind CSS v4 and autoprefixer plugins programmatically so the
 * CLI owns all CSS build dependencies — core doesn't need to ship postcss.config
 * or have CSS tooling in its own dependencies.
 * @returns {Object} PostCSS configuration for Vite's css.postcss option
 */
export function createPostCSSConfig() {
  return {
    plugins: [tailwindcssPlugin(), autoprefixerPlugin()],
  };
}

/**
 * Create Vite resolve configuration.
 * @returns {Object} Vite resolve configuration
 */
export function createViteResolveConfig() {
  return {};
}
