import { describe, expect, it } from 'vitest';
import { getThemeAssetSourcePath, isThemeAssetPair, resolveThemeAsset } from './resolveThemeAsset';

describe('resolveThemeAsset', () => {
  it('returns trimmed string assets', () => {
    expect(resolveThemeAsset('/app-icon.svg', 'light')).toBe('/app-icon.svg');
    expect(resolveThemeAsset('  /x.png  ', 'dark')).toBe('/x.png');
    expect(resolveThemeAsset('   ', 'light')).toBeUndefined();
    expect(resolveThemeAsset(undefined, 'dark')).toBeUndefined();
  });

  it('picks light/dark paths from pairs', () => {
    const pair = { light: '/a-light.png', dark: '/a-dark.png' };
    expect(resolveThemeAsset(pair, 'light')).toBe('/a-light.png');
    expect(resolveThemeAsset(pair, 'dark')).toBe('/a-dark.png');
  });
});

describe('isThemeAssetPair', () => {
  it('detects pair objects', () => {
    expect(isThemeAssetPair('/x.svg')).toBe(false);
    expect(isThemeAssetPair({ light: '/a.png', dark: '/b.png' })).toBe(true);
    expect(isThemeAssetPair(undefined)).toBe(false);
  });
});

describe('getThemeAssetSourcePath', () => {
  it('prefers light path for tooling', () => {
    expect(getThemeAssetSourcePath('/icon.svg')).toBe('/icon.svg');
    expect(getThemeAssetSourcePath({ light: '/l.png', dark: '/d.png' })).toBe('/l.png');
    expect(getThemeAssetSourcePath({ light: '', dark: '/d.png' })).toBe('/d.png');
  });
});
