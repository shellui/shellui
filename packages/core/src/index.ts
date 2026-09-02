/**
 * Shellui Core - Main entry point
 * Exports the App component, types, and utilities for use in config files and other packages.
 *
 * CSS is imported as a side effect. When using Shellui, run 'shellui build' to build your application.
 * The CLI will handle all CSS processing and bundling.
 */
import './index.css';

export { default as App } from './app.js';
export type {
  ShellUIConfig,
  DevConfig,
  ThemeAsset,
  NavigationItem,
  NavigationGroup,
  LocalizedString,
  ThemeDefinition,
  ThemeColors,
  ThemeColorsMode,
  ThemeFonts,
  ThemeInput,
  ThemeRef,
  ThemesConfig,
  DrawerPosition,
  LayoutType,
  BackendType,
  BackendConfig,
  AdministrationConfig,
  StorageConfig,
  HostingConfig,
  CookieConsentCategory,
  CookieDefinition,
  CookieConsentConfig,
  LegalDocumentsConfig,
} from './features/config/types.js';
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
  THEME_SCHEMA_VERSION,
  normalizeTheme,
  toThemeJson,
  resolveThemeConfig,
  hexToHsl,
  toCssVarValue,
  applyTheme,
  getTheme,
  getAllThemes,
  registerTheme,
  setAvailableThemes,
} from './features/theme/themes.js';
export { useConfig } from './features/config/useConfig.js';
export { useAuth } from './features/auth/hooks/useAuth.js';
export { AuthProvider } from './features/auth/AuthProvider.js';
export { ConfigProvider } from './features/config/ConfigProvider.js';
export type { ConfigContextValue, ConfigProviderProps } from './features/config/ConfigProvider.js';
export type { AuthSession } from './features/auth/hooks/useAuth.js';
export { default as urls } from './constants/urls.js';
export {
  getCookieConsentAccepted,
  getCookieConsentNeedsRenewal,
  getCookieConsentNewHosts,
} from './features/cookieConsent/cookieConsent.js';
export { useCookieConsent } from './features/cookieConsent/useCookieConsent.js';
