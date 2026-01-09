import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import pc from 'picocolors';

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
  const loaderScript = `
    import * as configModule from ${JSON.stringify(configFileUrl)};
    const result = configModule.default || configModule.config || configModule;
    console.log(JSON.stringify(result));
  `;
  
  // Write temporary script to load the config
  const tempScriptPath = path.join(configDir, '.shellui-config-loader.mjs');
  fs.writeFileSync(tempScriptPath, loaderScript);
  
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
    
    // Execute tsx to run the loader script
    const result = await new Promise((resolve, reject) => {
      const useNpx = !tsxPath;
      const command = useNpx ? 'npx' : 'node';
      const args = useNpx 
        ? ['-y', 'tsx', tempScriptPath]
        : [tsxPath, tempScriptPath];
      
      const child = spawn(command, args, {
        cwd: configDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env
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
          reject(new Error(`Failed to load TypeScript config: ${stderr || `Process exited with code ${code}`}`));
        } else {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
          } catch (parseError) {
            reject(new Error(`Failed to parse config output: ${parseError.message}\nOutput: ${stdout}\nStderr: ${stderr}`));
          }
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`Failed to execute tsx: ${error.message}`));
      });
    });
    
    // Clean up temp script
    if (fs.existsSync(tempScriptPath)) {
      fs.unlinkSync(tempScriptPath);
    }
    
    console.log(pc.green(`Loaded TypeScript config from ${configPath}`));
    return result;
  } catch (execError) {
    // Clean up temp script on error
    if (fs.existsSync(tempScriptPath)) {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    throw execError;
  }
}

/**
 * Load JSON configuration file
 * @param {string} configPath - Path to the JSON config file
 * @returns {Object} Configuration object
 */
export function loadJsonConfig(configPath) {
  const configFile = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configFile);
  console.log(pc.green(`Loaded JSON config from ${configPath}`));
  return config;
}
