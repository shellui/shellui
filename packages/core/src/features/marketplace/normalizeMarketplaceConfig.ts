import type {
  MarketplaceConfig,
  NavigationStorageMode,
  ResolvedMarketplaceConfig,
} from '../config/types';

export const DEFAULT_MARKETPLACE_URL = 'https://marketplace.shellui.com';
export const DEFAULT_MARKETPLACE_API_URL = 'https://api.marketplace.shellui.com';

export const MARKETPLACE_NAV_PATH = 'marketplace';
export const MARKETPLACE_NAV_LABEL = 'Shellui Marketplace';

export const NAVIGATION_OVERLAY_STORAGE_KEY = 'shellui.navigation.overlay';
export const NAVIGATION_OVERLAY_ENDPOINT = '/api/v1/navigation-overlay';

function cleanHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

function storageMode(value: unknown): NavigationStorageMode {
  if (value === 'localStorage' || value === 'api' || value === 'auto') return value;
  return 'auto';
}

function isDesktopTarget(): boolean {
  return typeof __SHELLUI_TARGET__ !== 'undefined' && __SHELLUI_TARGET__ === 'tauri';
}

/**
 * `true` selects every default. An object overrides only the fields that are set.
 * `false`, `null`, and omission leave Shellui Marketplace off. It is always off in the
 * desktop (Tauri) app.
 */
export function normalizeMarketplaceConfig(
  value: boolean | MarketplaceConfig | null | undefined,
): ResolvedMarketplaceConfig | null {
  // Shellui Marketplace is not available in the desktop app, whatever the config says.
  if (isDesktopTarget()) return null;
  if (value === null || value === undefined || value === false) return null;
  if (value !== true && (typeof value !== 'object' || Array.isArray(value))) return null;
  const input: MarketplaceConfig = value === true ? {} : value;
  const nav = input.navigationCustomization ?? {};
  const apiUrl = cleanHttpUrl(nav.apiUrl);
  return {
    url: cleanHttpUrl(input.url) ?? DEFAULT_MARKETPLACE_URL,
    apiUrl: cleanHttpUrl(input.apiUrl) ?? DEFAULT_MARKETPLACE_API_URL,
    allowThirdParty: input.allowThirdParty ?? true,
    navigationCustomization: {
      enabled: nav.enabled ?? true,
      storage: storageMode(nav.storage),
      ...(apiUrl ? { apiUrl } : {}),
    },
  };
}

export function marketplaceOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
