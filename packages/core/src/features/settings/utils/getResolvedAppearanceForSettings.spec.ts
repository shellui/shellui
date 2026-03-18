import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@shellui/sdk';
import type { ShellUIConfig, ThemeDefinition } from '../../config/types';
import { getResolvedAppearanceForSettings } from './getResolvedAppearanceForSettings';

describe('getResolvedAppearanceForSettings', () => {
  it('resolves and returns full appearance with registered theme data', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://shellui.dev' },
      matchMedia: () => ({ matches: true }),
    });

    const customTheme: ThemeDefinition = {
      name: 'custom-theme',
      displayName: 'Custom Theme',
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
      fontFiles: ['fonts/custom.woff2'],
      fontFamily: 'Inter',
    };

    const settings = {
      appearance: { name: 'custom-theme', colorScheme: 'system' },
    } as Settings;

    const config = {
      themes: [customTheme],
    } as ShellUIConfig;

    const appearance = getResolvedAppearanceForSettings(settings, config);

    expect(appearance?.name).toBe('custom-theme');
    expect(appearance?.mode).toBe('dark');
    expect(appearance?.fontFamily).toBe('Inter');
    expect(appearance?.fontFiles).toEqual(['https://shellui.dev/fonts/custom.woff2']);
  });
});
