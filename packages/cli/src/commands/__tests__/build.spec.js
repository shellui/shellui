import { describe, test, expect } from 'vitest';
import { rewriteRelativeAssetDepth } from '../build.js';

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
});
