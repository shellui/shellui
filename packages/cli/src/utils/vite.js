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

/**
 * Create Vite resolve.alias configuration.
 * Always sets '@' to core/src. Sets '@shellui/sdk' to source entry when in
 * workspace mode; omits the alias when installed from npm so Vite resolves
 * through the package's exports field (dist/index.js).
 * @returns {Object} Vite resolve.alias object
 */
export function createResolveAlias() {
  const corePackagePath = resolvePackagePath('@shellui/core');
  const sdkEntry = resolveSdkEntry();

  const alias = {
    '@': path.join(corePackagePath, 'src'),
  };

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
 * Create Vite define configuration for ShellUI config injection
 * App config is in __SHELLUI_CONFIG__; Sentry is in three separate globals
 * (__SHELLUI_SENTRY_DSN__, __SHELLUI_SENTRY_ENVIRONMENT__, __SHELLUI_SENTRY_RELEASE__).
 * @param {Object} config - Configuration object
 * @returns {Object} Vite define configuration
 */
export function createViteDefine(config) {
  // Ensure config is serializable; omit sentry so it is only in the three Sentry globals
  const serializableConfig = JSON.parse(JSON.stringify(config));
  delete serializableConfig.sentry;

  // Verify navigation is preserved after serialization
  if (config.navigation && !serializableConfig.navigation) {
    console.warn('Warning: Navigation was lost during serialization. This should not happen.');
  }

  const sentry = config?.sentry;
  // Double-stringify: Vite's define inserts the value as-is into the code
  // If we pass '{"title":"shellui"}', Vite inserts it as: const x = {"title":"shellui"}; (invalid - object literal)
  // If we pass '"{\"title\":\"shellui\"}"', Vite inserts it as: const x = "{\"title\":\"shellui\"}"; (valid - string literal)
  // So we need to double-stringify to ensure it's inserted as a string
  const configString = JSON.stringify(JSON.stringify(serializableConfig));

  return {
    __SHELLUI_CONFIG__: configString,
    __SHELLUI_SENTRY_DSN__: sentry?.dsn ? JSON.stringify(sentry.dsn) : 'undefined',
    __SHELLUI_SENTRY_ENVIRONMENT__: sentry?.environment
      ? JSON.stringify(sentry.environment)
      : 'undefined',
    __SHELLUI_SENTRY_RELEASE__: sentry?.release ? JSON.stringify(sentry.release) : 'undefined',
  };
}

/**
 * Create Vite resolve configuration with deduplication.
 * Prevents duplicate React instances and @shellui/core modules when running
 * from node_modules, which can cause context provider issues in microfrontends.
 * 
 * Dynamically includes all @shellui/core dependencies to ensure they resolve
 * from project root, preventing nested node_modules resolution issues.
 * @returns {Object} Vite resolve configuration with dedupe
 */
export function createViteResolveConfig() {
  return {
    dedupe: getDedupeList(),
  };
}

/**
 * Get dependencies from @shellui/core package.json
 * Reads the package.json and extracts all dependencies (excluding @shellui/* packages)
 * @returns {string[]} Array of dependency package names
 */
function getCoreDependencies() {
  try {
    const corePackagePath = resolvePackagePath('@shellui/core');
    const packageJsonPath = path.join(corePackagePath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`Warning: Could not find @shellui/core package.json at ${packageJsonPath}`);
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    
    // Extract all dependency names, excluding @shellui/* packages
    return Object.keys(dependencies).filter(
      (dep) => !dep.startsWith('@shellui/'),
    );
  } catch (e) {
    console.warn(`Warning: Failed to read @shellui/core dependencies: ${e.message}`);
    return [];
  }
}

/**
 * Get packages that should be excluded from optimization
 * These are @shellui/* packages that should always load from source
 * @returns {string[]} Array of package names to exclude
 */
export function getShelluiExcludePackages() {
  try {
    const corePackagePath = resolvePackagePath('@shellui/core');
    const packageJsonPath = path.join(corePackagePath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return ['@shellui/core', '@shellui/sdk'];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    
    // Extract @shellui/* packages that should be excluded
    const shelluiPackages = Object.keys(dependencies).filter(
      (dep) => dep.startsWith('@shellui/'),
    );
    
    // Always include @shellui/core and @shellui/sdk
    const exclude = ['@shellui/core', '@shellui/sdk'];
    shelluiPackages.forEach((pkg) => {
      if (!exclude.includes(pkg)) {
        exclude.push(pkg);
      }
    });
    
    return exclude;
  } catch (e) {
    console.warn(`Warning: Failed to read @shellui/* packages: ${e.message}`);
    return ['@shellui/core', '@shellui/sdk'];
  }
}

/**
 * Create Vite optimizeDeps configuration to exclude @shellui/core from pre-bundling.
 * This prevents Vite from creating duplicate module instances during dependency optimization,
 * which is critical for React Context to work correctly in microfrontend iframe scenarios.
 * 
 * Dynamically reads dependencies from @shellui/core to ensure all new dependencies
 * are automatically included in optimization.
 * 
 * Note: We do NOT exclude React/ReactDOM here because Vite needs to optimize them.
 * The resolve.dedupe configuration handles ensuring only one React instance is used.
 * @returns {Object} Vite optimizeDeps configuration
 */
export function createViteOptimizeDepsConfig() {
  const coreDependencies = getCoreDependencies();
  const excludePackages = getShelluiExcludePackages();
  
  return {
    exclude: excludePackages,
    include: coreDependencies,
  };
}

/**
 * Get deduplication list for Vite resolve configuration
 * Includes React, ReactDOM, @shellui packages, and all @shellui/core dependencies
 * @returns {string[]} Array of package names to dedupe
 */
export function getDedupeList() {
  const coreDependencies = getCoreDependencies();
  const shelluiPackages = getShelluiExcludePackages();
  
  // Base dedupe list: React, ReactDOM, and @shellui packages
  const dedupe = ['react', 'react-dom', ...shelluiPackages];
  
  // Add all core dependencies to ensure they resolve from project root
  coreDependencies.forEach((dep) => {
    if (!dedupe.includes(dep)) {
      dedupe.push(dep);
    }
  });
  
  return dedupe;
}
