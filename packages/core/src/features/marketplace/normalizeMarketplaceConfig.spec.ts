import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MARKETPLACE_API_URL,
  DEFAULT_MARKETPLACE_URL,
  normalizeMarketplaceConfig,
} from './normalizeMarketplaceConfig';

describe('normalizeMarketplaceConfig', () => {
  it('resolves true to the public defaults', () => {
    expect(normalizeMarketplaceConfig(true)).toEqual({
      url: DEFAULT_MARKETPLACE_URL,
      apiUrl: DEFAULT_MARKETPLACE_API_URL,
      allowThirdParty: true,
      navigationCustomization: { enabled: true, storage: 'auto' },
    });
    expect(DEFAULT_MARKETPLACE_URL).toBe('https://marketplace.shellui.com');
    expect(DEFAULT_MARKETPLACE_API_URL).toBe('https://api.marketplace.shellui.com');
  });

  it('lets a host override only the fields it sets', () => {
    expect(
      normalizeMarketplaceConfig({
        url: 'https://market.example.com/',
        allowThirdParty: false,
        navigationCustomization: {
          storage: 'localStorage',
          apiUrl: 'https://id.example.com/overlay',
        },
      }),
    ).toEqual({
      url: 'https://market.example.com',
      apiUrl: DEFAULT_MARKETPLACE_API_URL,
      allowThirdParty: false,
      navigationCustomization: {
        enabled: true,
        storage: 'localStorage',
        apiUrl: 'https://id.example.com/overlay',
      },
    });
  });

  it('stays off when marketplace is omitted or false', () => {
    expect(normalizeMarketplaceConfig(undefined)).toBeNull();
    expect(normalizeMarketplaceConfig(false)).toBeNull();
    expect(normalizeMarketplaceConfig(null)).toBeNull();
  });

  it('is always off in the desktop app, whatever the config says', () => {
    vi.stubGlobal('__SHELLUI_TARGET__', 'tauri');
    try {
      expect(normalizeMarketplaceConfig(true)).toBeNull();
      expect(normalizeMarketplaceConfig({ allowThirdParty: true })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal('__SHELLUI_TARGET__', 'web');
    try {
      expect(normalizeMarketplaceConfig(true)).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is off in a desktop package that runs a plain web build', () => {
    vi.stubGlobal('__SHELLUI_TARGET__', 'web');
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    try {
      expect(normalizeMarketplaceConfig(true)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(normalizeMarketplaceConfig(true)).not.toBeNull();
  });
});
