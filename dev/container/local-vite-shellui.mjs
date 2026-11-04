/**
 * Vite merge helpers for the dev stack: resolve @shellui/* from monorepo source.
 */
import fs from 'node:fs';
import path from 'node:path';

/** @param {string | undefined} shelluiRoot */
export function resolveShelluiRoot(shelluiRoot) {
  const root = shelluiRoot ? path.resolve(shelluiRoot) : '';
  if (!root || !fs.existsSync(path.join(root, 'packages', 'sdk', 'package.json'))) {
    return null;
  }
  return root;
}

/**
 * @param {string} shelluiRoot
 * @returns {Record<string, string>}
 */
export function shelluiSourceAliases(shelluiRoot) {
  const packages = path.join(shelluiRoot, 'packages');
  /** @type {Record<string, string>} */
  const alias = {};

  const sdkSrc = path.join(packages, 'sdk', 'src', 'index.ts');
  if (fs.existsSync(sdkSrc)) {
    alias['@shellui/sdk'] = sdkSrc;
    alias['@shellui/sdk/tiny'] = path.join(packages, 'sdk', 'src', 'tiny.ts');
    alias['@shellui/sdk/react'] = path.join(packages, 'sdk', 'src', 'react.ts');
  }

  const coreSrc = path.join(packages, 'core', 'src', 'index.ts');
  if (fs.existsSync(coreSrc)) {
    alias['@shellui/core'] = coreSrc;
    alias['@shellui/core/ContentView'] = path.join(
      packages,
      'core',
      'src',
      'components',
      'ContentView.tsx',
    );
    alias['@shellui/core/types'] = path.join(
      packages,
      'core',
      'src',
      'features',
      'config',
      'types.ts',
    );
  }

  const cliBin = path.join(packages, 'cli', 'bin', 'shellui.js');
  if (fs.existsSync(cliBin)) {
    alias['@shellui/cli'] = path.join(packages, 'cli');
  }

  return alias;
}

/** @param {string | null | undefined} shelluiRoot */
export function createShelluiDevStackPlugins(shelluiRoot) {
  const root = resolveShelluiRoot(shelluiRoot ?? process.env.SHELLUI_ROOT);
  if (!root) {
    return [];
  }

  const localAliases = shelluiSourceAliases(root);
  const aliasKeys = Object.keys(localAliases).sort((a, b) => b.length - a.length);

  /** @type {import('vite').Plugin} */
  const devStackPlugin = {
    name: 'shellui-dev-local-packages',
    enforce: 'pre',
    resolveId(source) {
      for (const key of aliasKeys) {
        if (source === key) {
          return localAliases[key];
        }
      }
      return null;
    },
    configResolved(resolved) {
      const dedupe = new Set(resolved.resolve.dedupe ?? []);
      dedupe.add('react');
      dedupe.add('react-dom');
      dedupe.add('@shellui/sdk');
      dedupe.add('@shellui/core');
      resolved.resolve.dedupe = [...dedupe];

      const exclude = new Set(resolved.optimizeDeps.exclude ?? []);
      exclude.add('@shellui/sdk');
      exclude.add('@shellui/core');
      resolved.optimizeDeps.exclude = [...exclude];

      const allow = new Set(resolved.server.fs.allow);
      allow.add(root);
      allow.add(path.join(root, 'packages'));
      allow.add(path.join(root, 'node_modules'));
      resolved.server.fs.allow = [...allow];
    },
  };

  return [devStackPlugin];
}

/**
 * @param {import('vite').UserConfig} config
 * @param {string | null | undefined} shelluiRoot
 * @param {{ appDir?: string; workspaceRoot?: string }} [options]
 * @returns {import('vite').UserConfig}
 */
export function mergeShelluiLocalViteConfig(config, shelluiRoot, options = {}) {
  void config;
  void options;
  return {
    plugins: createShelluiDevStackPlugins(shelluiRoot),
  };
}
