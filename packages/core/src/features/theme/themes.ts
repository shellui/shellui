/**
 * Theme system public surface for internal imports.
 * Prefer importing from `@shellui/core` in app code.
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
export { applyTheme } from './applyTheme';
export { normalizeTheme, toThemeJson } from './normalize';
export { resolveThemeConfig } from './resolveConfig';
export type { ResolveThemeConfigInput, ResolvedThemeConfig } from './resolveConfig';
export {
  registerTheme,
  setAvailableThemes,
  getTheme,
  getAllThemes,
  clearThemeRegistry,
} from './registry';

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
