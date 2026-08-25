/**
 * Node- and browser-safe theme API (no React, no CSS side effects).
 * Import from `@shellui/core/theme` in the CLI or tooling.
 */

export type {
  ThemeColors,
  ThemeColorsMode,
  ThemeColorsModePartial,
  ThemeDefinition,
  ThemeFonts,
  ThemeInput,
  ThemeRef,
  ThemesConfig,
  ThemeColorKey,
} from './types';
export { THEME_SCHEMA_VERSION, THEME_COLOR_KEYS } from './types';

export { hexToHsl, toCssVarValue, isHexColor } from './color';
export { normalizeTheme, toThemeJson } from './normalize';
export { resolveThemeConfig } from './resolveConfig';
export type { ResolveThemeConfigInput, ResolvedThemeConfig } from './resolveConfig';
export {
  defaultTheme,
  themes,
  themeNames,
  recommendedThemeNames,
  curatedThemes,
  shelluiTheme,
  claudeTheme,
  lightGreenTheme,
  zenInspiredTheme,
  astroVistaTheme,
} from './curated';
