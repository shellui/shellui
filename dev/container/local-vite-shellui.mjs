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

/**
 * @param {import('vite').UserConfig} config
 * @param {string | null} shelluiRoot
 * @returns {import('vite').UserConfig}
 */
export function mergeShelluiLocalViteConfig(config, shelluiRoot) {
  const root = resolveShelluiRoot(shelluiRoot ?? process.env.SHELLUI_ROOT);
  if (!root) return config;

  const localAliases = shelluiSourceAliases(root);
  if (Object.keys(localAliases).length === 0) return config;

  const existingAlias = config.resolve?.alias ?? {};
  const normalized =
    Array.isArray(existingAlias)
      ? Object.fromEntries(
          existingAlias.map((entry) =>
            typeof entry === 'object' && entry && 'find' in entry
              ? [String(entry.find), entry.replacement]
              : ['', ''],
          ),
        )
      : { ...existingAlias };

  /** Prefer app vite.config aliases, then fill gaps from the monorepo. */
  const alias = { ...localAliases, ...normalized };

  const allowRoots = new Set(config.server?.fs?.allow ?? []);
  allowRoots.add(root);
  allowRoots.add(path.join(root, 'packages'));
  allowRoots.add(path.join(root, 'node_modules'));

  const optimizeDeps = { ...(config.optimizeDeps ?? {}) };
  const exclude = new Set(optimizeDeps.exclude ?? []);
  exclude.add('@shellui/sdk');
  exclude.add('@shellui/core');
  optimizeDeps.exclude = [...exclude];

  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias,
      dedupe: [
        ...new Set([
          ...(config.resolve?.dedupe ?? []),
          'react',
          'react-dom',
          '@shellui/sdk',
          '@shellui/core',
        ]),
      ],
    },
    optimizeDeps,
    server: {
      ...config.server,
      fs: {
        ...config.server?.fs,
        allow: [...allowRoots],
      },
    },
  };
}
