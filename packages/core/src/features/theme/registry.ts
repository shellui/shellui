import { defaultTheme, themes as curatedThemes } from './curated';
import type { ThemeDefinition } from './types';

/**
 * Registry of themes available to the running shell (from resolved config).
 * Curated themes remain importable via `themes` / `defaultTheme` from `@shellui/core`.
 */
const themeRegistry = new Map<string, ThemeDefinition>();

/**
 * Register a custom theme (overrides same name).
 */
export function registerTheme(theme: ThemeDefinition): void {
  themeRegistry.set(theme.name, theme);
}

/**
 * Replace the set of available themes (used after config resolution).
 */
export function setAvailableThemes(themeList: ThemeDefinition[]): void {
  themeRegistry.clear();
  for (const theme of themeList) {
    themeRegistry.set(theme.name, theme);
  }
}

/**
 * Get a theme by name from the registry, falling back to curated built-ins.
 */
export function getTheme(name: string): ThemeDefinition | undefined {
  return themeRegistry.get(name) ?? curatedThemes[name];
}

/**
 * Themes currently available in the app (registry only).
 * Empty until config themes are registered.
 */
export function getAllThemes(): ThemeDefinition[] {
  if (themeRegistry.size === 0) {
    return [defaultTheme];
  }
  return Array.from(themeRegistry.values());
}

/**
 * Clear registry (tests).
 */
export function clearThemeRegistry(): void {
  themeRegistry.clear();
}
