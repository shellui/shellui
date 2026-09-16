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
  shadcnTheme,
  amberMinimalTheme,
  amethystHazeTheme,
  boldTechTheme,
  bubblegumTheme,
  caffeineTheme,
  candylandTheme,
  catppuccinTheme,
  claymorphismTheme,
  cleanSlateTheme,
  cosmicNightTheme,
  cyberpunkTheme,
  darkmatterTheme,
  doom64Theme,
  elegantLuxuryTheme,
  graphiteTheme,
  kodamaGroveTheme,
  midnightBloomTheme,
  mochaMousseTheme,
  modernMinimalTheme,
  monoTheme,
  natureTheme,
  neoBrutalismTheme,
  northernLightsTheme,
  notebookTheme,
  oceanBreezeTheme,
  pastelDreamsTheme,
  perpetuityTheme,
  quantumRoseTheme,
  retroArcadeTheme,
  sageGardenTheme,
  softPopTheme,
  solarDuskTheme,
  starryNightTheme,
  sunsetHorizonTheme,
  supabaseTheme,
  t3ChatTheme,
  tangerineTheme,
  twitterTheme,
  vercelTheme,
  vintagePaperTheme,
  violetBloomTheme,
} from './curated';
