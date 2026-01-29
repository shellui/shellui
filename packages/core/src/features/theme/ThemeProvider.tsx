import * as React from 'react';
import { useTheme } from './useTheme';

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that applies theme (light/dark/system and theme colors) from settings.
 * Must be rendered inside SettingsProvider so useTheme can read appearance settings.
 * Applies theme to document.documentElement and listens to system preference changes.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useTheme();
  return <>{children}</>;
}
