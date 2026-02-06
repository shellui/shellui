/**
 * ShellUI Core - Main entry point
 * Exports types and utilities for use in config files and other packages
 */

export type {
  ShellUIConfig,
  NavigationItem,
  NavigationGroup,
  LocalizedString,
  ThemeDefinition,
  ThemeColors,
  DrawerPosition,
  LayoutType,
  CookieConsentCategory,
  CookieDefinition,
  CookieConsentConfig,
} from './features/config/types.js';
export { useConfig } from './features/config/useConfig.js';
export { default as urls } from './constants/urls.js';
export {
  getCookieConsentAccepted,
  getCookieConsentNeedsRenewal,
  getCookieConsentNewHosts,
} from './features/cookieConsent/cookieConsent.js';
export { useCookieConsent } from './features/cookieConsent/useCookieConsent.js';
