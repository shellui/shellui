import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import pc from 'picocolors';
import { loadConfig, getCoreSrcPath, createViteDefine, resolvePackagePath } from '../utils/index.js';

/**
 * Build command - Builds the ShellUI application for production
 * @param {string} root - Root directory (default: '.')
 */
export async function buildCommand(root = '.') {
  const cwd = process.cwd();
  
  console.log(pc.blue(`Building ShellUI...`));
  
  // Load configuration
  const config = loadConfig(root);
  
  // Get core package paths
  const corePackagePath = resolvePackagePath('@shellui/core');
  const coreSrcPath = getCoreSrcPath();

  try {
    await build({
      root: coreSrcPath,
      plugins: [react()],
      define: createViteDefine(config),
      resolve: {
        alias: {
          '@': path.join(corePackagePath, 'src'),
        },
      },
      build: {
        outDir: path.resolve(cwd, 'dist'),
        emptyOutDir: true,
      }
    });
    console.log(pc.green('Build complete!'));
  } catch (e) {
    console.error(pc.red(`Error building: ${e.message}`));
    process.exit(1);
  }
}

