/* eslint-disable no-console */
import { useLayoutEffect } from 'react';
import { useSettings } from '../settings/hooks/useSettings';
import { useConfig } from '../config/useConfig';
import { getTheme, registerTheme, applyTheme, type ThemeDefinition } from './themes';

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
  const { settings } = useSettings();
  const { config } = useConfig();
  const colorScheme = settings.appearance?.colorScheme ?? 'system';
  const themeName = settings.appearance?.name ?? 'default';

  // Apply theme immediately on mount (synchronously) to prevent empty colors
  // This ensures CSS variables are set before first render
  useLayoutEffect(() => {
    // Get the effective theme name (from settings or config)
    // Use themeName from settings first, then config defaultTheme, then 'default'
    const effectiveThemeName = themeName || config?.defaultTheme || 'default';

    if (config?.themes) {
      config.themes.forEach((themeDef: ThemeDefinition) => {
        registerTheme(themeDef);
      });
    }

    const themeDefinition = getTheme(effectiveThemeName) || getTheme('default');

    if (themeDefinition) {
      const determineIsDark = () => {
        if (colorScheme === 'system') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          return mediaQuery.matches;
        }
        return colorScheme === 'dark';
      };
      const isDark = determineIsDark();
      applyThemeToDocument(isDark);
      applyTheme(themeDefinition, isDark);
    } else {
      console.error('[Theme] No theme definition found, using fallback');
      // Fallback: at least set primary color from default theme
      const defaultTheme = getTheme('default');
      if (defaultTheme) {
        const isDark =
          colorScheme === 'dark' ||
          (colorScheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        applyTheme(defaultTheme, isDark);
      }
    }
  }, [colorScheme, themeName, config]); // Run when colorScheme, themeName, or config changes
}
