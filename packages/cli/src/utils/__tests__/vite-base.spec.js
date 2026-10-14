import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import { build } from 'vite';
import { createIsolatedViteConfig } from '../vite.js';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Build a tiny shell index.html with the isolated Vite config and return it.
 * @param {'web' | 'tauri'} target
 * @returns {Promise<string>}
 */
async function buildIndexHtml(target) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-vite-base-'));
  tempDirs.push(projectRoot);
  const coreSrcPath = path.join(projectRoot, 'core-src');
  fs.mkdirSync(path.join(projectRoot, 'static'), { recursive: true });
  fs.mkdirSync(coreSrcPath, { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'static', 'favicon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  fs.writeFileSync(path.join(coreSrcPath, 'main.js'), 'export default 1;\n');
  fs.writeFileSync(
    path.join(coreSrcPath, 'index.html'),
    [
      '<!doctype html>',
      '<html><head>',
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
      '</head><body>',
      '<script type="module" src="/main.js"></script>',
      '</body></html>',
    ].join('\n'),
  );

  const previous = process.env.SHELLUI_TARGET;
  if (target === 'tauri') process.env.SHELLUI_TARGET = 'tauri';
  else delete process.env.SHELLUI_TARGET;

  try {
    const isolated = createIsolatedViteConfig({
      projectRoot,
      coreSrcPath,
      corePackagePath: coreSrcPath,
      shelluiConfig: {},
    });
    expect(isolated.base).toBe('/');

    const outDir = path.join(projectRoot, 'dist');
    await build({
      ...isolated,
      logLevel: 'silent',
      build: {
        ...isolated.build,
        outDir,
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions: {
          input: {
            main: path.join(coreSrcPath, 'index.html'),
          },
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
      },
    });

    return fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  } finally {
    if (previous === undefined) delete process.env.SHELLUI_TARGET;
    else process.env.SHELLUI_TARGET = previous;
  }
}

function expectAbsoluteAssetPaths(html) {
  expect(html).toMatch(/src="\/assets\/main-[^"]+\.js"/);
  expect(html).toMatch(/href="\/favicon\.svg"/);
  expect(html).not.toMatch(/(?:src|href)="\.\//);
}

describe('web asset base', () => {
  test('built index.html uses absolute asset paths', async () => {
    expectAbsoluteAssetPaths(await buildIndexHtml('web'));
  });

  test('Tauri builds keep absolute asset paths', async () => {
    expectAbsoluteAssetPaths(await buildIndexHtml('tauri'));
  });
});
