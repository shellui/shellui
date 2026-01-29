import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { loadConfig, getCoreSrcPath, createViteDefine, resolvePackagePath } from '../utils/index.js';

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

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
 * Build command - Builds the ShellUI application for production
 * @param {string} root - Root directory (default: '.')
 */
export async function buildCommand(root = '.') {
  const cwd = process.cwd();

  console.log(pc.blue(`Building ShellUI...`));

  // Load configuration
  const config = await loadConfig(root);

  // Get core package paths
  const corePackagePath = resolvePackagePath('@shellui/core');
  const sdkPackagePath = resolvePackagePath('@shellui/sdk');
  const coreSrcPath = getCoreSrcPath();

  try {
    await build({
      root: coreSrcPath,
      plugins: [react()],
      define: createViteDefine(config),
      resolve: {
        alias: {
          '@': path.join(corePackagePath, 'src'),
          '@shellui/sdk': path.join(sdkPackagePath, 'src/index.ts'),
        },
      },
      build: {
        outDir: path.resolve(cwd, 'dist'),
        emptyOutDir: true,
      }
    });

    // Copy static folder contents to dist if it exists
    // This ensures icons are served from the same path in dev and prod
    const staticPath = path.resolve(cwd, 'static');
    const distPath = path.resolve(cwd, 'dist');

    if (fs.existsSync(staticPath)) {
      console.log(pc.blue('Copying static assets...'));
      // Copy contents of static directly to dist (not dist/static)
      // This way /icons/... works in both dev and prod
      copyDir(staticPath, distPath);
      console.log(pc.green('Static assets copied!'));
    }

    console.log(pc.green('Build complete!'));
  } catch (e) {
    console.error(pc.red(`Error building: ${e.message}`));
    process.exit(1);
  }
}

