import { useEffect } from 'react';
import { useSettings } from '../SettingsContext';

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
 */
export function useTheme() {
  const { settings } = useSettings();
  const theme = settings.appearance?.theme || 'system';

  useEffect(() => {
    if (theme === 'system') {
      // Listen to system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // Apply initial theme
      applyThemeToDocument(mediaQuery.matches);

      // Listen for changes
      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        applyThemeToDocument(e.matches);
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
    } else {
      // Apply explicit theme
      applyThemeToDocument(theme === 'dark');
    }
  }, [theme]);
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

  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyThemeToDocument(mediaQuery.matches);
  } else {
    applyThemeToDocument(theme === 'dark');
  }
}
