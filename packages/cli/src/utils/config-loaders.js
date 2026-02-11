import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import pc from 'picocolors';

/** Stub used when tsx resolves @shellui/config (CJS) in the child process. */
const STUB_SOURCE = `exports.shelluiConfig = {};
exports.default = exports.shelluiConfig;
`;

/**
 * Load TypeScript configuration file using tsx
 * @param {string} configPath - Path to the TypeScript config file
 * @param {string} configDir - Directory containing the config file
 * @returns {Promise<Object>} Configuration object
 */
export async function loadTypeScriptConfig(configPath, configDir) {
  // Load TypeScript config using tsx CLI via child process
  // This avoids module cycle issues with dynamic registration
  // Use file URL for the import to ensure proper resolution
  const configFileUrl = pathToFileURL(configPath).href;
  const configPathLiteral = JSON.stringify(configPath);
  const loaderScript = `
    import * as configModule from ${JSON.stringify(configFileUrl)};
    import fs from 'node:fs';
    import path from 'node:path';
    const configPath = ${configPathLiteral};
    let result = configModule.default || configModule.config || configModule;
    if (result && typeof result === 'object' && result.default && Object.keys(result).length === 1) {
      result = result.default;
    }
    const serializedConfig = JSON.parse(JSON.stringify(result));
    const configDir = path.dirname(configPath);
    const content = fs.readFileSync(configPath, 'utf8');
    const importMap = {};
    const importRe = /import\\s+(?:\\{\\s*([^}]+)\\}\\s+from\\s+['"]([^'"]+)['"]|(\\w+)\\s+from\\s+['"]([^'"]+)['"])/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
      const fromPath = m[2] || m[4];
      if (m[1]) {
        m[1].split(',').forEach((id) => {
          const name = id.trim().replace(/^type\\s+/, '').split(/\s+as\s+/).pop().trim();
          if (name && name !== 'type') importMap[name] = fromPath;
        });
      } else if (m[3]) {
        importMap[m[3]] = fromPath;
      }
    }
    const flattenNav = (nav) => (nav || []).flatMap((item) => (item.items ? item.items : [item]));
    const items = flattenNav(result.navigation);
    const componentPaths = {};
    const componentNames = {};
    for (const item of items) {
      if (item.component && typeof item.component === 'function' && item.component.name) {
        const modulePath = importMap[item.component.name];
        if (modulePath && !modulePath.startsWith('@')) {
          const key = item.path === '' || item.path === '/' ? 'home' : item.path;
          componentPaths[key] = path.resolve(configDir, modulePath);
          componentNames[key] = item.component.name;
        }
      }
    }
    console.log(JSON.stringify({ config: serializedConfig, componentPaths, componentNames }));
  `;

  const tempScriptPath = path.join(configDir, '.shellui-config-loader.mjs');
  const stubPkgDir = path.join(configDir, 'node_modules', '@shellui', 'config');
  fs.writeFileSync(tempScriptPath, loaderScript);

  // Install stub for @shellui/config in project node_modules so tsx can load config files
  // that pull in useConfig → @shellui/config. Remove after load.
  const stubExisted = fs.existsSync(stubPkgDir);
  if (!stubExisted) {
    fs.mkdirSync(stubPkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(stubPkgDir, 'package.json'),
      JSON.stringify({ type: 'commonjs', main: 'index.cjs' }),
    );
    fs.writeFileSync(path.join(stubPkgDir, 'index.cjs'), STUB_SOURCE);
  }

  try {
    // Find tsx - try to resolve it from node_modules
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    let tsxPath;
    try {
      // Try to resolve tsx package
      const tsxPackagePath = require.resolve('tsx/package.json');
      const tsxPackageDir = path.dirname(tsxPackagePath);
      tsxPath = path.join(tsxPackageDir, 'dist/cli.mjs');

      if (!fs.existsSync(tsxPath)) {
        throw new Error('tsx CLI not found');
      }
    } catch (resolveError) {
      // Fallback to npx if tsx not found
      tsxPath = null;
    }

    // Execute tsx to run the loader script (NODE_PATH points to stub so @shellui/config resolves).
    const result = await new Promise((resolve, reject) => {
      const useNpx = !tsxPath;
      const command = useNpx ? 'npx' : 'node';
      const args = useNpx ? ['-y', 'tsx', tempScriptPath] : [tsxPath, tempScriptPath];

      const childEnv = {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        SHELLUI_BUILD: process.env.SHELLUI_BUILD || 'false',
      };

      const child = spawn(command, args, {
        cwd: configDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Failed to load TypeScript config: ${stderr || `Process exited with code ${code}`}`,
            ),
          );
        } else {
          try {
            const parsed = JSON.parse(stdout.trim());
            const config = parsed.config ?? parsed.default ?? parsed;
            const componentPaths = parsed.componentPaths || {};
            const componentNames = parsed.componentNames || {};
            if (config.navigation && Object.keys(componentPaths).length > 0) {
              const setComponentPaths = (nav) => {
                for (const item of nav) {
                  if (item.items) setComponentPaths(item.items);
                  else {
                    const key = item.path === '' || item.path === '/' ? 'home' : item.path;
                    if (componentPaths[key]) {
                      item.componentPath = componentPaths[key];
                      if (componentNames[key]) item.componentExportName = componentNames[key];
                    }
                  }
                }
              };
              setComponentPaths(config.navigation);
            }
            resolve(config);
          } catch (parseError) {
            reject(
              new Error(
                `Failed to parse config output: ${parseError.message}\nOutput: ${stdout}\nStderr: ${stderr}`,
              ),
            );
          }
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute tsx: ${error.message}`));
      });
    });

    if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
    if (!stubExisted && fs.existsSync(stubPkgDir)) {
      try {
        fs.rmSync(stubPkgDir, { recursive: true });
      } catch (e) {}
    }

    console.log(pc.green(`Loaded TypeScript config from ${configPath}`));
    return result;
  } catch (execError) {
    if (fs.existsSync(tempScriptPath)) {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {}
    }
    if (!stubExisted && fs.existsSync(stubPkgDir)) {
      try {
        fs.rmSync(stubPkgDir, { recursive: true });
      } catch (e) {}
    }
    throw execError;
  }
}
