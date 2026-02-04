import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { injectManifest } from 'workbox-build';
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
  
  // Log config summary for debugging
  console.log(pc.blue(`Config loaded:`));
  console.log(pc.gray(`  - Title: ${config.title || '(not set)'}`));
  console.log(pc.gray(`  - Navigation items: ${config.navigation?.length || 0}`));
  console.log(pc.gray(`  - Layout: ${config.layout || 'sidebar'}`));
  
  // Verify config is serializable
  try {
    const testSerialize = JSON.parse(JSON.stringify(config));
    console.log(pc.green(`  ✓ Config is serializable`));
  } catch (e) {
    console.error(pc.red(`  ✗ Config is not serializable: ${e.message}`));
    throw e;
  }

  // Get core package paths
  const corePackagePath = resolvePackagePath('@shellui/core');
  const sdkPackagePath = resolvePackagePath('@shellui/sdk');
  const coreSrcPath = getCoreSrcPath();

  try {
    // Build main app
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
        sourcemap: true,
        // Ensure every build generates unique filenames with content hashes
        // Content hash changes when file content changes, ensuring cache busting
        rollupOptions: {
          input: {
            main: path.join(coreSrcPath, 'index.html'),
          },
          output: {
            // Use content hash in filenames for cache busting
            // [hash] is based on file content, so same content = same hash
            // Different content = different hash, ensuring unique filenames per build when content changes
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
      }
    });

    // Build service worker with Vite first
    console.log(pc.blue('Building service worker...'));
    const swInputPath = path.join(corePackagePath, 'src', 'service-worker', 'sw.ts');
    const distPath = path.resolve(cwd, 'dist');
    const swTempPath = path.join(distPath, 'sw-temp.js');
    
    // Build service worker TypeScript to JavaScript
    await build({
      root: coreSrcPath,
      define: createViteDefine(config),
      resolve: {
        alias: {
          '@': path.join(corePackagePath, 'src'),
          '@shellui/sdk': path.join(sdkPackagePath, 'src/index.ts'),
        },
      },
      build: {
        outDir: distPath,
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
          input: swInputPath,
          output: {
            dir: distPath,
            entryFileNames: 'sw-temp.js',
            format: 'es',
          },
        },
        write: true,
      },
    });

    // Use workbox-build to inject manifest
    const { count, size, warnings } = await injectManifest({
      swSrc: swTempPath,
      swDest: path.join(distPath, 'sw.js'),
      globDirectory: distPath,
      globPatterns: [
        '**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,ico}',
      ],
      // Don't precache the service worker itself or source maps
      globIgnores: ['sw.js', 'sw-temp.js', '**/*.map', '**/node_modules/**'],
      // Maximum file size to precache (5MB)
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    });

    // Remove temporary file
    if (fs.existsSync(swTempPath)) {
      fs.unlinkSync(swTempPath);
    }

    if (warnings.length > 0) {
      warnings.forEach(warning => console.warn(pc.yellow(`Warning: ${warning}`)));
    }

    console.log(pc.green(`Service worker generated: ${count} files precached (${(size / 1024).toFixed(2)} KB)`));

    // Copy static folder contents to dist if it exists
    // This ensures icons are served from the same path in dev and prod
    const staticPath = path.resolve(cwd, 'static');

    if (fs.existsSync(staticPath)) {
      console.log(pc.blue('Copying static assets...'));
      // Copy contents of static directly to dist (not dist/static)
      // This way /icons/... works in both dev and prod
      copyDir(staticPath, distPath);
      console.log(pc.green('Static assets copied!'));
    }

    // Copy index.html to 404.html for SPA routing support
    // This allows hosting providers (like Netlify, Vercel) to serve index.html for all routes
    const indexPath = path.join(distPath, 'index.html');
    const notFoundPath = path.join(distPath, '404.html');
    
    if (fs.existsSync(indexPath)) {
      console.log(pc.blue('Creating 404.html for SPA routing...'));
      fs.copyFileSync(indexPath, notFoundPath);
      console.log(pc.green('404.html created!'));
    }

    console.log(pc.green('Build complete!'));
  } catch (e) {
    console.error(pc.red(`Error building: ${e.message}`));
    process.exit(1);
  }
}

