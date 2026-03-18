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
  serviceWorker: { enabled: true },
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
});
