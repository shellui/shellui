import path from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect } from 'vitest';
import {
  rewriteRelativeAssetDepth,
  getMaterializedRoutePaths,
  getShellBuiltinRoutePaths,
} from '../build.js';

const corePackagePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../core',
);

const INDEX = [
  '<link rel="icon" href="./favicon.svg" type="image/svg+xml" />',
  '<script type="module" crossorigin src="./assets/main-abc.js"></script>',
  '<link rel="stylesheet" crossorigin href="./assets/main-abc.css">',
].join('\n');

describe('rewriteRelativeAssetDepth', () => {
  test('leaves root (depth 0) copies untouched', () => {
    expect(rewriteRelativeAssetDepth(INDEX, 0)).toBe(INDEX);
  });

  test('rewrites depth-1 route copies to climb one folder', () => {
    const out = rewriteRelativeAssetDepth(INDEX, 1);
    expect(out).toContain('href="../favicon.svg"');
    expect(out).toContain('src="../assets/main-abc.js"');
    expect(out).toContain('href="../assets/main-abc.css"');
    expect(out).not.toContain('"./assets');
  });

  test('rewrites nested route copies by their depth', () => {
    const out = rewriteRelativeAssetDepth(INDEX, 2);
    expect(out).toContain('src="../../assets/main-abc.js"');
    expect(out).toContain('href="../../favicon.svg"');
  });

  test('does not touch absolute or protocol URLs', () => {
    const html = '<script src="/assets/x.js"></script><img src="https://cdn/x.png" />';
    expect(rewriteRelativeAssetDepth(html, 2)).toBe(html);
  });

  test('login/callback depth 2 rewrites assets to ../../assets/', () => {
    const out = rewriteRelativeAssetDepth(INDEX, 2);
    expect(out).toContain('src="../../assets/main-abc.js"');
    expect(out).toContain('href="../../assets/main-abc.css"');
    expect(out).not.toContain('"./assets');
  });
});

describe('getShellBuiltinRoutePaths', () => {
  test('includes login and login/callback from core urls.ts', () => {
    const paths = getShellBuiltinRoutePaths(corePackagePath);
    expect(paths).toContain('login');
    expect(paths).toContain('login/callback');
    expect(paths).toContain('__settings');
    expect(paths).toContain('__cookie-preferences');
  });
});

describe('getMaterializedRoutePaths', () => {
  test('always includes shell built-ins even with empty navigation', () => {
    const paths = getMaterializedRoutePaths([], corePackagePath);
    expect(paths).toContain('login/callback');
    expect(paths).toContain('login');
  });

  test('unions navigation paths with shell built-ins and dedupes', () => {
    const paths = getMaterializedRoutePaths([{ path: 'home' }, { path: 'login' }], corePackagePath);
    expect(paths).toContain('home');
    expect(paths).toContain('login');
    expect(paths).toContain('login/callback');
    expect(paths.filter((p) => p === 'login')).toHaveLength(1);
  });

  test('includes configured admin pathname override', () => {
    const paths = getMaterializedRoutePaths([], corePackagePath, {
      backend: { adminPathname: '/custom-admin' },
    });
    expect(paths).toContain('custom-admin');
  });
});
