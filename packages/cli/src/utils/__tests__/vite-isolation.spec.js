import { test, describe, expect } from 'vitest';
import path from 'path';
import {
  createIsolatedViteConfig,
  createPostCSSConfig,
  getShelluiViteCacheDir,
  SHELLUI_VITE_CACHE_DIR,
} from '../vite.js';

const projectRoot = '/tmp/consumer-app';
const coreSrcPath = '/tmp/node_modules/@shellui/core/src';
const corePackagePath = '/tmp/node_modules/@shellui/core';

describe('createPostCSSConfig', () => {
  test('refuses to default Tailwind base to cwd', () => {
    expect(() => createPostCSSConfig()).toThrow(/scanBaseDir/);
  });
});

describe('createIsolatedViteConfig', () => {
  const isolated = createIsolatedViteConfig({
    projectRoot,
    coreSrcPath,
    corePackagePath,
    shelluiConfig: {},
  });

  test('does not load consumer Vite, env, or VITE_ prefix', () => {
    expect(isolated.configFile).toBe(false);
    expect(isolated.envDir).toBe(false);
    expect(isolated.envPrefix).toBe('SHELLUI_PUBLIC_');
  });

  test('uses relative base for deployable dist/web output', () => {
    expect(isolated.base).toBe('./');
  });

  test('roots the shell in @shellui/core, not the consumer project', () => {
    expect(isolated.root).toBe(coreSrcPath);
    expect(isolated.cacheDir).toBe(getShelluiViteCacheDir(projectRoot));
    expect(isolated.cacheDir).toContain(SHELLUI_VITE_CACHE_DIR);
    expect(isolated.cacheDir).not.toBe(path.join(projectRoot, 'node_modules', '.vite'));
  });

  test('skips consumer tsconfig for transforms and optimizeDeps', () => {
    expect(isolated.esbuild.tsconfigRaw.compilerOptions.jsx).toBe('automatic');
    expect(isolated.optimizeDeps.esbuildOptions.tsconfigRaw.compilerOptions.jsx).toBe('automatic');
  });

  test('does not allow serving the consumer project src', () => {
    const allow = isolated.server.fs.allow;
    expect(isolated.server.fs.strict).toBe(true);
    expect(allow).toContain(corePackagePath);
    expect(allow).not.toContain(projectRoot);
    expect(allow).not.toContain(path.join(projectRoot, 'src'));
  });

  test('excludes @mlc-ai/web-llm from optimizeDeps when AI is enabled (default)', () => {
    expect(isolated.optimizeDeps.exclude).toContain('@mlc-ai/web-llm');
    expect(isolated.optimizeDeps.include).not.toContain('@mlc-ai/web-llm');
    expect(isolated.optimizeDeps.include).toContain('loglevel');
    expect(isolated.optimizeDeps.needsInterop).not.toContain('@mlc-ai/web-llm');
    expect(isolated.optimizeDeps.needsInterop).toContain('loglevel');
    expect(isolated.worker.format).toBe('es');
  });

  test('does not touch WebLLM optimizeDeps when ai.enabled is false', () => {
    const disabled = createIsolatedViteConfig({
      projectRoot,
      coreSrcPath,
      corePackagePath,
      shelluiConfig: { ai: { enabled: false } },
    });
    expect(disabled.optimizeDeps.exclude).toBeUndefined();
    expect(disabled.optimizeDeps.include).toBeUndefined();
  });

  test('allows custom themes dir when configured', () => {
    const themesDir = '/tmp/consumer-app/themes';
    const withThemes = createIsolatedViteConfig({
      projectRoot,
      coreSrcPath,
      corePackagePath,
      shelluiConfig: { __themesDirAbs: themesDir },
    });
    expect(withThemes.server.fs.allow).toContain(themesDir);
  });
});
