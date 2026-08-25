import { useLayoutEffect, useEffect } from 'react';
import { useSettings } from '../settings/hooks/useSettings';
import { useConfig } from '../config/useConfig';
import {
  getTheme,
  setAvailableThemes,
  applyTheme,
  defaultTheme,
  type ThemeDefinition,
} from './themes';

/**
 * Apply theme to document element
 */
function applyThemeToDocument(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Hook to apply theme based on settings
 * Applies 'dark' class to document.documentElement based on:
 * - 'light': removes dark class
 * - 'dark': adds dark class
 * - 'system': follows prefers-color-scheme media query
 * Also applies theme colors based on themeName setting
 */
export function useTheme() {
  const { settings, updateSetting } = useSettings();
  const { config } = useConfig();
  const colorScheme = settings.appearance?.colorScheme ?? 'system';
  const themeName = settings.appearance?.name;
  const configDefault = config?.activeTheme || config?.defaultTheme || defaultTheme.name;

  // Seed appearance.name from config when the user has no stored preference yet
  useEffect(() => {
    if (!config) return;
    if (themeName) return;
    if (!configDefault) return;
    updateSetting('appearance', { name: configDefault });
  }, [config, configDefault, themeName, updateSetting]);

  useLayoutEffect(() => {
    const effectiveThemeName = themeName || configDefault || defaultTheme.name;

    const available: ThemeDefinition[] =
      config?.themes && Array.isArray(config.themes) && config.themes.length > 0
        ? (config.themes as ThemeDefinition[])
        : [defaultTheme];

    setAvailableThemes(available);

    const themeDefinition =
      getTheme(effectiveThemeName) || getTheme(defaultTheme.name) || defaultTheme;

    const determineIsDark = () => {
      if (colorScheme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return colorScheme === 'dark';
    };

    let isDark = determineIsDark();
    applyThemeToDocument(isDark);
    applyTheme(themeDefinition, isDark);

    if (colorScheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      isDark = mediaQuery.matches;
      applyThemeToDocument(isDark);
      applyTheme(themeDefinition, isDark);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [colorScheme, themeName, config, configDefault]);
}
