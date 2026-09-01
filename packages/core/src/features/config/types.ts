// Language-specific label/title
export type LocalizedString =
  | string
  | {
      en: string;
      fr: string;
      [key: string]: string; // Allow other language codes
    };

/** Drawer position when opening a link in a drawer (optional, used when openIn === 'drawer'). */
export type DrawerPosition = 'top' | 'bottom' | 'left' | 'right';

/** Layout mode: 'sidebar' (default) shows navigation sidebar; 'fullscreen' shows only content area; 'windows' shows a taskbar with start menu and multi-window desktop; 'app-bar' shows a compact top bar with a 9-square launcher for start links and icon-only end links. */
export type LayoutType = 'sidebar' | 'fullscreen' | 'windows' | 'app-bar';

export interface NavigationItem {
  label: string | LocalizedString;
  path: string;
  url: string;
  icon?: string; // Path to SVG icon file (e.g., '/icons/book-open.svg')
  /** When true, hide this item from the sidebar and 404 page; route remains valid and item still appears in Develop settings. */
  hidden?: boolean;
  /** When true, hide this item from navigation when the user is not authenticated. */
  hideWhenLoggedOut?: boolean;
  /** When true, navigating to this route requires authentication and redirects to login with a next URL. */
  requiresAuth?: boolean;
  /** When true, this item is available only when Settings > Advanced > Developer features is enabled. */
  requiresDevMode?: boolean;
  /** When true, this item is available only to staff users (`isStaff`). */
  requiresStaff?: boolean;
  /** When true, hide this item on mobile (sidebar sheet). Has no effect if hidden is true. */
  hiddenOnMobile?: boolean;
  /** When true, hide this item on desktop (sidebar). Has no effect if hidden is true. */
  hiddenOnDesktop?: boolean;
  /** How to open this link: 'default' (navigate in main area), 'modal', 'drawer', or 'external' (target="_blank"). */
  openIn?: 'default' | 'modal' | 'drawer' | 'external';
  /** When true, the app uses hash-based routing (e.g. /#/path). If omitted, inferred from url containing /#/. */
  useHashRouter?: boolean;
  /** Optional drawer position when openIn === 'drawer'. Default is 'right' if omitted. */
  drawerPosition?: DrawerPosition;
  /** Sidebar position: 'start' (default) or 'end'. End items are rendered in the sidebar footer. */
  position?: 'start' | 'end';
  /** URL to display as a settings panel in Settings > Applications. When set, the nav item appears in the Applications group. */
  settings?: string;
  /**
   * Trust control for auth token sharing to iframe apps.
   * - undefined/true: trusted (default), token can be shared
   * - false: untrusted, token is never shared
   */
  safeForAuthToken?: boolean;
}

export interface NavigationGroup {
  title: string | LocalizedString;
  items: NavigationItem[];
  /** Sidebar position: 'start' (default) or 'end'. End groups are rendered in the sidebar footer. */
  position?: 'start' | 'end';
}

export type {
  ThemeColors,
  ThemeColorsMode,
  ThemeDefinition,
  ThemeFonts,
  ThemeInput,
  ThemeRef,
  ThemesConfig,
} from '../theme/types';

import type { ThemeDefinition, ThemeRef, ThemesConfig } from '../theme/types';

/** Sentry error reporting configuration. Only used in production; ignored in dev. */
export interface SentryConfig {
  /** Sentry DSN (Data Source Name). Required for Sentry to receive events. */
  dsn: string;
  /** Environment name (e.g. 'production', 'staging'). Shown in Sentry dashboard. */
  environment?: string;
  /** Release identifier (e.g. git SHA or version). Used for release-based grouping. */
  release?: string;
}

/**
 * Cookie consent categories for privacy-friendly grouping in the UI.
 * - strict_necessary: Required for the app to work; typically no consent needed.
 * - functional_performance: Analytics, performance, preferences.
 * - targeting: Advertising, personalisation.
 * - social_media_embedded: Social widgets, embedded content.
 */
export type CookieConsentCategory =
  | 'strict_necessary'
  | 'functional_performance'
  | 'targeting'
  | 'social_media_embedded';

/**
 * Definition of a cookie that can be toggled by the user via cookie consent.
 * Host is the unique key: use it to gate features (e.g. getCookieConsentAccepted('sentry.io')).
 */
export interface CookieDefinition {
  /** Display name for the cookie (e.g. "Sentry Error Reporting"). */
  name: string;
  /** Host or domain the cookie belongs to (e.g. "sentry.io", ".example.com"). Unique key for consent and feature gating. */
  host: string;
  /** Duration in seconds (e.g. 31536000 for 1 year). */
  durationSeconds: number;
  /** Type label for clarity (e.g. "first_party", "third_party", "http_only"). */
  type: string;
  /** Category for grouping in the consent UI. */
  category: CookieConsentCategory;
  /** Optional short description shown in the consent / settings UI. Can be a string or localized object with language keys. */
  description?: LocalizedString;
}

/**
 * Cookie consent configuration. Accepted hosts are stored in settings; store
 * consentedCookieHosts when user submits so we can detect new cookies and re-prompt while keeping existing approvals.
 */
export interface CookieConsentConfig {
  /** List of cookies the app may use. User consent is collected per category/cookie. */
  cookies: CookieDefinition[];
}

export interface LegalDocumentsConfig {
  privacyPolicy?: string;
  termsOfService?: string;
  legalNotice?: string;
  dataProcessingAgreement?: string;
}

/** Supported backend providers for auth/API communication. */
export type BackendType = 'shellui' | 'supabase';

/** Supported auth login methods that can be declared in config. */
export type BackendLoginMethod = 'password' | 'oauth' | 'magic_link' | 'web3';

/** Optional login capabilities declared by app config for immediate UI rendering. */
export interface BackendLoginConfig {
  /** Enabled login methods shown by the Login view. */
  methods?: BackendLoginMethod[];
  /** OAuth providers used when oauth is enabled (e.g. ["github"]). */
  oauthProviders?: string[];
  /** Full-bleed iframe URL for the login left panel (wins over panelImage). */
  panelUrl?: string;
  /** Centered, ratio-preserving image for the login left panel. */
  panelImage?: string;
}

/** Backend API configuration. */
export interface BackendConfig {
  /** Backend provider type. */
  type: BackendType;
  /** Base URL used to access backend APIs. */
  url: string;
  /** Admin route pathname (e.g. "/admin"). Used as Shell route path for embedded admin panel. */
  adminPathname?: string;
  /** Admin content URL loaded in the admin route view (e.g. "https://example.com/admin"). */
  adminUrl?: string;
  /**
   * Public origin (or full URL) of this shell — where `/login` and OAuth `/login/callback` live.
   * Used by `shellui login`. Not the iframe admin app (`adminUrl`).
   * Example: `https://app.example.com` or `http://127.0.0.1:4000`.
   */
  loginUrl?: string;
  /** Optional Supabase publishable key (public key). */
  publishableKey?: string;
  /** Optional login capabilities used by frontend for immediate rendering. */
  login?: BackendLoginConfig;
  /** Optional tenant id used for multi-tenant shellui-auth calls. */
  companyId?: string | number;
}

/**
 * Optional storage-service wiring for the shell and admin panel.
 * When set, admin shows the Storage sidebar (files explorer, statistics, Django admin).
 * Settings → Storage (quota) appears when `url` is set, unless `showInSettings` is false.
 * Shellui will also use this for the SDK file API (`shellui.storage`).
 */
export interface StorageConfig {
  /** Base URL of storage-service (e.g. `http://localhost:8001`). */
  url: string;
  /** Files explorer app URL embedded under Admin → Storage → Files (e.g. `http://localhost:5175/`). */
  filesUrl?: string;
  /**
   * When false, hide Settings → Storage even if `url` is set.
   * Admin Storage is unaffected. Default: true.
   */
  showInSettings?: boolean;
}

/**
 * Custom navigation section for the staff administration panel.
 * Admin app URL remains `backend.adminUrl` / `backend.adminPathname`.
 * v1 is a flat list only (no nested groups).
 */
export interface AdministrationConfig {
  /** Section title shown in the admin sidebar below Dashboard. */
  title: string | LocalizedString;
  /**
   * Flat list of navigation items (same shape as top-level `navigation` items).
   * Order is preserved in the admin sidebar.
   */
  navigation: NavigationItem[];
}

/**
 * Brand asset path, or separate light/dark files when CSS theming is not enough
 * (typical for full-color PNGs). A single SVG/PNG is recolored for light/dark via CSS.
 */
export type ThemeAsset =
  | string
  | {
      light: string;
      dark: string;
    };

export interface ShellUIConfig {
  port?: number;
  title?: string;
  /** App version string (e.g. "1.2.0"). Shown in Settings > System > Update app. */
  version?: string;
  /** Favicon path (e.g. '/favicon.svg'). Used for the document link rel="icon". */
  favicon?: string;
  /**
   * Small square app icon (e.g. '/app-icon.svg').
   * Shown in the sidebar header, app-bar, and windows start menu.
   * Use a string for SVG/mono icons (auto light/dark via CSS), or `{ light, dark }` for paired PNGs.
   */
  appIcon?: ThemeAsset;
  /**
   * Logo path (e.g. '/logo.svg'). Wider wordmark; use a string or `{ light, dark }` pair.
   * Prefer `appIcon` for the small square mark in chrome.
   */
  logo?: ThemeAsset;
  language?: string | string[]; // Single language code or array of enabled language codes (e.g., 'en' or ['en', 'fr'])
  /** Layout mode: 'sidebar' (default) or 'fullscreen'. Fullscreen shows only content with no navigation. */
  layout?: LayoutType;
  /** When set, opening the app at "/" redirects to this path (e.g. "/playground"). */
  start_url?: string;
  navigation?: (NavigationItem | NavigationGroup)[];
  /**
   * Custom navigation for the staff admin panel (below Dashboard).
   * Propagated to the admin iframe via SDK settings. See Administration docs.
   */
  administration?: AdministrationConfig;
  /**
   * Storage-service connection. Propagated to iframes via SDK settings.
   * Enables Admin → Storage when `url` is set. Settings → Storage (quota) is shown
   * when `url` is set unless `storage.showInSettings` is false.
   */
  storage?: StorageConfig;
  /**
   * Single theme: built-in name, path to a theme JSON/folder, or inline theme object.
   * When set without `themes`, only this theme is available in the selector.
   */
  theme?: ThemeRef;
  /**
   * Available themes for the app.
   * - Array of built-in names, paths, or inline objects
   * - Map of id → name | path | object
   * After CLI load, resolved to a `ThemeDefinition[]` for the runtime.
   */
  themes?: ThemesConfig | ThemeDefinition[];
  /**
   * Directory of theme JSON files (one `.json` per theme) with optional sibling
   * `<name>/fonts/` folders. Resolved by the CLI at load/build time.
   */
  themesDir?: string;
  /**
   * Active theme name on first visit (and when no user preference is stored).
   * Prefer this over `defaultTheme`.
   */
  activeTheme?: string;
  /**
   * Default theme name. Alias of `activeTheme` (kept for backward compatibility).
   */
  defaultTheme?: string;
  /** Sentry error reporting. Load from env (e.g. SENTRY_DSN). Only active in production builds. */
  sentry?: SentryConfig;
  /** Backend communication config. Defaults to undefined (no backend integration). */
  backend?: BackendConfig;
  /** Cookie consent: list of cookies by category; accepted ids are stored in settings. */
  cookieConsent?: CookieConsentConfig;
  /** Legal documents content rendered as markdown. */
  legalDocuments?: LegalDocumentsConfig;
  /**
   * CLI-only companion for `shellui start`. Spawn `run` and/or follow `url`.
   * Stripped before the config is sent to the browser.
   */
  dev?: DevConfig;
}

/** Companion process for local `shellui start` (not used at runtime in the shell). */
export interface DevConfig {
  /** Command to spawn in the project root (e.g. `vite`). */
  run?: string;
  /** URL (or host:port) to wait for / follow. */
  url?: string;
  /** Log prefix name (default: `app`). */
  name?: string;
}
