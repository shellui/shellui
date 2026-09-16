import type { ThemeAsset } from '../../config/types';

/** Pick the concrete URL for the current color mode. */
export function resolveThemeAsset(
  asset: ThemeAsset | undefined,
  mode: 'light' | 'dark',
): string | undefined {
  if (!asset) return undefined;
  if (typeof asset === 'string') {
    const trimmed = asset.trim();
    return trimmed || undefined;
  }
  const path = (mode === 'dark' ? asset.dark : asset.light)?.trim();
  return path || undefined;
}

/** True when light/dark are separate files (skip CSS invert filters). */
export function isThemeAssetPair(asset: ThemeAsset | undefined): asset is {
  light: string;
  dark: string;
} {
  return typeof asset === 'object' && asset !== null && 'light' in asset && 'dark' in asset;
}

/** Prefer light (or dark) path for tooling that needs a single file (e.g. Tauri icons). */
export function getThemeAssetSourcePath(asset: ThemeAsset | undefined): string | undefined {
  if (!asset) return undefined;
  if (typeof asset === 'string') {
    const trimmed = asset.trim();
    return trimmed || undefined;
  }
  return asset.light?.trim() || asset.dark?.trim() || undefined;
}
