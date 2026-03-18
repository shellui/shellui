import { describe, expect, it } from 'vitest';
import type { Settings } from '@shellui/sdk';
import { mergePreferencesIntoSettings } from './mergePreferencesIntoSettings';

const baseSettings: Settings = {
  developerFeatures: { enabled: false },
  errorReporting: { enabled: true },
  logging: { namespaces: { shellsdk: false, shellcore: false } },
  appearance: {
    name: 'default',
    displayName: 'Default',
    mode: 'light',
    colorScheme: 'system',
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

describe('mergePreferencesIntoSettings', () => {
  it('applies valid preference values', () => {
    const result = mergePreferencesIntoSettings(baseSettings, {
      themeName: 'blue',
      language: 'fr',
      region: 'Europe/Paris',
      colorScheme: 'dark',
    });

    expect(result.appearance.name).toBe('blue');
    expect(result.appearance.colorScheme).toBe('dark');
    expect(result.language.code).toBe('fr');
    expect(result.region.timezone).toBe('Europe/Paris');
  });

  it('keeps current language and color scheme when incoming values are invalid', () => {
    const result = mergePreferencesIntoSettings(baseSettings, {
      language: 'es',
      colorScheme: undefined,
    });

    expect(result.language.code).toBe('en');
    expect(result.appearance.colorScheme).toBe('system');
  });
});
