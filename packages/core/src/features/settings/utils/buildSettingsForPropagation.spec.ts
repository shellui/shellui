import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@shellui/sdk';
import type { ShellUIConfig } from '../../config/types';
import { buildSettingsForPropagation } from './buildSettingsForPropagation';

const baseSettings: Settings = {
  developerFeatures: { enabled: false },
  errorReporting: { enabled: true },
  logging: { namespaces: { shellsdk: false, shellcore: false } },
  appearance: {
    name: 'default',
    displayName: 'Default',
    mode: 'light',
    colorScheme: 'light',
    colors: {
      light: {
        background: '#fff',
        foreground: '#000',
        card: '#fff',
        cardForeground: '#000',
        popover: '#fff',
        popoverForeground: '#000',
        primary: '#000',
        primaryForeground: '#fff',
        secondary: '#eee',
        secondaryForeground: '#000',
        muted: '#eee',
        mutedForeground: '#333',
        accent: '#eee',
        accentForeground: '#000',
        destructive: '#f00',
        destructiveForeground: '#fff',
        border: '#ccc',
        input: '#ccc',
        ring: '#000',
        radius: '0.5rem',
        sidebarBackground: '#fff',
        sidebarForeground: '#000',
        sidebarPrimary: '#000',
        sidebarPrimaryForeground: '#fff',
        sidebarAccent: '#eee',
        sidebarAccentForeground: '#000',
        sidebarBorder: '#ccc',
        sidebarRing: '#000',
      },
      dark: {
        background: '#000',
        foreground: '#fff',
        card: '#000',
        cardForeground: '#fff',
        popover: '#000',
        popoverForeground: '#fff',
        primary: '#fff',
        primaryForeground: '#000',
        secondary: '#111',
        secondaryForeground: '#fff',
        muted: '#111',
        mutedForeground: '#ddd',
        accent: '#111',
        accentForeground: '#fff',
        destructive: '#900',
        destructiveForeground: '#fff',
        border: '#333',
        input: '#333',
        ring: '#fff',
        radius: '0.5rem',
        sidebarBackground: '#000',
        sidebarForeground: '#fff',
        sidebarPrimary: '#fff',
        sidebarPrimaryForeground: '#000',
        sidebarAccent: '#111',
        sidebarAccentForeground: '#fff',
        sidebarBorder: '#333',
        sidebarRing: '#fff',
      },
    },
  },
  language: { code: 'en' },
  region: { timezone: 'UTC' },
  cookieConsent: { acceptedHosts: [], consentedCookieHosts: [] },
  serviceWorker: { enabled: false },
  user: null,
};

describe('buildSettingsForPropagation', () => {
  it('adds localized navigation items and available themes', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://shellui.dev' },
      matchMedia: () => ({ matches: false }),
    });

    const config = {
      navigation: [
        {
          title: 'Main',
          items: [
            {
              label: { en: 'Docs', fr: 'Docs FR' },
              path: '/docs',
              url: '/docs',
            },
          ],
        },
      ],
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'fr');

    expect(result.navigation?.items).toEqual([
      {
        path: '/docs',
        url: '/docs',
        label: 'Docs FR',
      },
    ]);
    expect(result.appearance?.availableThemes?.length).toBeGreaterThan(0);
  });

  it('injects access token into settings.user only when explicitly allowed', () => {
    const settingsWithUser: Settings = {
      ...baseSettings,
      user: {
        id: 'u1',
        email: 'dev@shellui.dev',
        name: 'Dev User',
        profilePicture: null,
        authProvider: 'github',
      },
    };

    const safeResult = buildSettingsForPropagation(settingsWithUser, undefined, 'en', {
      includeAuthAccessToken: true,
      accessToken: 'jwt.safe.token',
    });
    expect(safeResult.accessToken).toBe('jwt.safe.token');

    const unsafeResult = buildSettingsForPropagation(settingsWithUser, undefined, 'en', {
      includeAuthAccessToken: false,
      accessToken: 'jwt.should.not.be.exposed',
    });
    expect(unsafeResult.accessToken).toBeNull();
  });

  it('injects authBackendBaseUrl when backend type is shellui', () => {
    const config = {
      backend: {
        type: 'shellui' as const,
        url: 'https://id.example.com/',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.authBackendBaseUrl).toBe('https://id.example.com');
  });

  it('sets authBackendBaseUrl to null when backend is not shellui', () => {
    const config = {
      backend: {
        type: 'supabase' as const,
        url: 'https://xyz.supabase.co',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.authBackendBaseUrl).toBeNull();
  });

  it('injects localized administration navigation from config', () => {
    const config = {
      storage: { url: 'http://localhost:8001/', filesUrl: 'http://localhost:5175/' },
      administration: {
        title: { en: 'Applications', fr: 'Applications FR' },
        navigation: [
          {
            label: { en: 'Billing', fr: 'Facturation' },
            path: 'billing',
            url: 'https://app.example.com/billing',
            icon: '/icons/billing.svg',
          },
          {
            label: { en: 'Django admin', fr: 'Admin Django' },
            path: 'django-admin',
            url: '/admin/',
            requiresStaff: true,
            openIn: 'external',
          },
        ],
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'fr');
    expect(result.administration).toEqual({
      title: 'Applications FR',
      navigation: [
        {
          path: 'billing',
          url: 'https://app.example.com/billing',
          label: 'Facturation',
          icon: '/icons/billing.svg',
        },
        {
          path: 'django-admin',
          url: '/admin/',
          label: 'Admin Django',
          requiresStaff: true,
          openIn: 'external',
        },
      ],
    });
    expect(result.storage).toEqual({
      url: 'http://localhost:8001',
      filesUrl: 'http://localhost:5175/',
    });
  });

  it('sets administration and storage to null when not configured', () => {
    const result = buildSettingsForPropagation(baseSettings, undefined, 'en');
    expect(result.administration).toBeNull();
    expect(result.storage).toBeNull();
  });

  it('propagates showInAdmin false when hosting admin is disabled', () => {
    const config = {
      hosting: {
        url: 'http://localhost:8002/',
        showInAdmin: false,
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.hosting).toEqual({
      url: 'http://localhost:8002',
      showInAdmin: false,
    });
  });

  it('omits showInAdmin from propagated hosting by default', () => {
    const config = {
      hosting: {
        url: 'http://localhost:8002',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.hosting).toEqual({ url: 'http://localhost:8002' });
  });
});
