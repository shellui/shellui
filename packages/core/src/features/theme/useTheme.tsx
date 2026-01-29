import { useEffect } from 'react';
import * as React from 'react';
import { useSettings } from '../settings/SettingsContext';
import { useConfig } from '../config/useConfig';
import { getTheme, registerTheme, applyTheme, type ThemeDefinition } from './themes';

const STORAGE_KEY = 'shellui:settings';

/**
 * Get initial theme from localStorage to prevent FOUC
 */
function getInitialTheme(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.appearance?.theme || 'system';
    }
  } catch (error) {
    // Ignore errors
  }

  return 'system';
}

/**
 * Get initial theme name from localStorage to prevent FOUC
 */
function getInitialThemeName(): string {
  if (typeof window === 'undefined') {
    return 'default';
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.appearance?.themeName || 'default';
    }
  } catch (error) {
    // Ignore errors
  }

  return 'default';
}

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
  const theme = settings.appearance?.theme || 'system';
  const themeName = settings.appearance?.themeName || 'default';

  // Apply theme immediately on mount (synchronously) to prevent empty colors
  // This ensures CSS variables are set before first render
  React.useLayoutEffect(() => {
    // Get the effective theme name (from settings or config)
    // Use themeName from settings first, then config defaultTheme, then 'default'
    const effectiveThemeName = themeName || (config?.defaultTheme) || 'default';
    const themeDefinition = getTheme(effectiveThemeName) || getTheme('default');
    
    if (themeDefinition) {
      const determineIsDark = () => {
        if (theme === 'system') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          return mediaQuery.matches;
        }
        return theme === 'dark';
      };
      const isDark = determineIsDark();
      applyThemeToDocument(isDark);
      applyTheme(themeDefinition, isDark);
    } else {
      console.error('[Theme] No theme definition found, using fallback');
      // Fallback: at least set primary color from default theme
      const defaultTheme = getTheme('default');
      if (defaultTheme) {
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        applyTheme(defaultTheme, isDark);
      }
    }
  }, [theme, themeName, config]); // Run when theme, themeName, or config changes

  // Register custom themes from config
  useEffect(() => {
    if (config?.themes) {
      config.themes.forEach((themeDef: ThemeDefinition) => {
        registerTheme(themeDef);
      });
    }
  }, [config]);

  // Apply theme colors and dark/light mode when settings/config change
  useEffect(() => {
    // Use config defaultTheme if no themeName is set, otherwise use settings themeName
    const effectiveThemeName = themeName || config?.defaultTheme || 'default';
    const themeDefinition = getTheme(effectiveThemeName) || getTheme('default');
    if (!themeDefinition) {
      console.warn(`Theme "${effectiveThemeName}" not found, using default`);
      return;
    }

    const determineIsDark = () => {
      if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        return mediaQuery.matches;
      }
      return theme === 'dark';
    };

    const isDark = determineIsDark();
    
    // Apply dark/light class
    applyThemeToDocument(isDark);
    
    // Apply theme colors
    applyTheme(themeDefinition, isDark);

    if (theme === 'system') {
      // Listen to system preference changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        const newIsDark = e.matches;
        applyThemeToDocument(newIsDark);
        applyTheme(themeDefinition, newIsDark);
      };

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
      // Fallback for older browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [theme, themeName, config]);
}

/**
 * Initialize theme immediately (before React) to prevent FOUC
 * This should be called in a script tag in the HTML
 */
export function initializeTheme() {
  if (typeof window === 'undefined') {
    return;
  }

  const theme = getInitialTheme();
  const themeName = getInitialThemeName();
  
  // Try to get theme definition (only default themes available at this point)
  const themeDefinition = getTheme(themeName);
  
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = mediaQuery.matches;
    applyThemeToDocument(isDark);
    if (themeDefinition) {
      applyTheme(themeDefinition, isDark);
    }
  } else {
    const isDark = theme === 'dark';
    applyThemeToDocument(isDark);
    if (themeDefinition) {
      applyTheme(themeDefinition, isDark);
    }
  }
}
