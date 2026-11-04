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

/** @param {string} appDir */
export function viteDevWrapperConfigPath(appDir) {
  return path.join(appDir, 'node_modules', '.shellui', 'vite-dev.config.mjs');
}

/**
 * @param {{ appConfigPath?: string; localAliases: Record<string, string>; aliasKeys: string[]; monorepoRoot: string | null }} opts
 */
export function generateViteDevWrapperSource(opts) {
  const { appConfigPath = '', localAliases, aliasKeys, monorepoRoot } = opts;
  const userConfigBlock = appConfigPath
    ? `const appRoot = process.env.SHELLUI_VITE_APP_DIR || process.cwd();
  const loaded = await loadConfigFromFile(env, ${JSON.stringify(appConfigPath)}, appRoot);
  const userConfig = loaded?.config ?? {};`
    : 'const userConfig = {};';

  return `import { loadConfigFromFile } from 'vite';

export default async (env) => {
  ${userConfigBlock}
  const localAliases = ${JSON.stringify(localAliases)};
  const aliasKeys = ${JSON.stringify(aliasKeys)};
  const shelluiMonorepoRoot = ${JSON.stringify(monorepoRoot)};
  const shelluiPlugins =
    aliasKeys.length > 0
      ? [
          {
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
              if (!shelluiMonorepoRoot) return;
              const dedupe = new Set(resolved.resolve.dedupe ?? []);
              for (const pkg of ['react', 'react-dom', '@shellui/sdk', '@shellui/core']) {
                dedupe.add(pkg);
              }
              resolved.resolve.dedupe = [...dedupe];
              const exclude = new Set(resolved.optimizeDeps.exclude ?? []);
              exclude.add('@shellui/sdk');
              exclude.add('@shellui/core');
              resolved.optimizeDeps.exclude = [...exclude];
              const allow = new Set(resolved.server.fs.allow);
              allow.add(shelluiMonorepoRoot);
              allow.add(shelluiMonorepoRoot + '/packages');
              allow.add(shelluiMonorepoRoot + '/node_modules');
              resolved.server.fs.allow = [...allow];
            },
          },
        ]
      : [];
  return {
    ...userConfig,
    configFile: false,
    plugins: [...(userConfig.plugins ?? []), ...shelluiPlugins],
  };
};
`;
}

/**
 * Prefer pnpm's node_modules/.bin/vite shim so NODE_PATH includes the app dependency tree.
 *
 * @param {{ appDir: string; vitePkgPath: string }} opts
 * @returns {{ command: string; argsPrefix: string[] }}
 */
export function resolveViteLaunch(opts) {
  const { appDir, vitePkgPath } = opts;
  const viteBin = path.join(path.dirname(vitePkgPath), 'bin', 'vite.js');
  const viteBinShim = path.join(appDir, 'node_modules', '.bin', 'vite');
  if (fs.existsSync(viteBinShim)) {
    return { command: viteBinShim, argsPrefix: [] };
  }
  return { command: process.execPath, argsPrefix: [viteBin] };
}
