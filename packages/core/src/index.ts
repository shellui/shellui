/**
 * ShellUI Core - Main entry point
 * Exports the App component, types, and utilities for use in config files and other packages.
 *
 * CSS is imported as a side effect. When using ShellUI, run 'shellui build' to build your application.
 * The CLI will handle all CSS processing and bundling.
 */
import './index.css';

export { default as App } from './app.js';
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
