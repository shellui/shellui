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

/** Layout mode: 'sidebar' (default) shows navigation sidebar; 'fullscreen' shows only content area; 'windows' shows a taskbar with start menu and multi-window desktop; 'app-bar' shows a compact top bar with select menu for start links and icon-only end links. */
export type LayoutType = 'sidebar' | 'fullscreen' | 'windows' | 'app-bar';

export interface NavigationItem {
  label: string | LocalizedString;
  path: string;
  url: string;
  icon?: string; // Path to SVG icon file (e.g., '/icons/book-open.svg')
  /** When true, hide this item from the sidebar and 404 page; route remains valid and item still appears in Develop settings. */
  hidden?: boolean;
  /** When true, hide this item on mobile (bottom nav). Has no effect if hidden is true. */
  hiddenOnMobile?: boolean;
  /** When true, hide this item on desktop (sidebar). Has no effect if hidden is true. */
  hiddenOnDesktop?: boolean;
  /** How to open this link: 'default' (navigate in main area), 'modal', 'drawer', or 'external' (target="_blank"). */
  openIn?: 'default' | 'modal' | 'drawer' | 'external';
  /** Optional drawer position when openIn === 'drawer'. Default is 'right' if omitted. */
  drawerPosition?: DrawerPosition;
  /** Sidebar position: 'start' (default) or 'end'. End items are rendered in the sidebar footer. */
  position?: 'start' | 'end';
  /** URL to display as a settings panel in Settings > Applications. When set, the nav item appears in the Applications group. */
  settings?: string;
}

export interface NavigationGroup {
  title: string | LocalizedString;
  items: NavigationItem[];
  /** Sidebar position: 'start' (default) or 'end'. End groups are rendered in the sidebar footer. */
  position?: 'start' | 'end';
}

export interface ThemeColors {
  light: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    radius: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
  };
  dark: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    radius: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
  };
}

export interface ThemeDefinition {
  name: string;
  displayName: string;
  colors: ThemeColors;
  fontFamily?: string; // Optional custom font family (backward compatible)
  headingFontFamily?: string; // Optional font family for headings (h1-h6)
  bodyFontFamily?: string; // Optional font family for body text
  fontFiles?: string[]; // Optional array of font file URLs or paths to load (e.g., Google Fonts links or local paths)
  letterSpacing?: string; // Optional custom letter spacing (e.g., "0.02em")
  textShadow?: string; // Optional custom text shadow (e.g., "1px 1px 2px rgba(0, 0, 0, 0.1)")
  lineHeight?: string; // Optional custom line height (e.g., "1.6")
}

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

/** When set to 'tauri', disables service worker and hides its settings (Tauri uses a different caching system). */
export type RuntimeType = 'browser' | 'tauri';

export interface ShellUIConfig {
  port?: number;
  title?: string;
  /** App version string (e.g. "1.2.0"). Shown in Settings > System > Update app. */
  version?: string;
  /** Set to 'tauri' when the app runs inside Tauri so service worker is disabled and hidden. */
  runtime?: RuntimeType;
  /** Favicon path (e.g. '/favicon.svg'). Used for the document link rel="icon". */
  favicon?: string;
  /** App icon path (e.g. '/favicon.svg'). Displayed before title/logo in sidebar header. */
  appIcon?: string;
  /** Logo path (e.g. '/logo.svg'). If defined, displayed as image in sidebar header instead of text title. */
  logo?: string;
  language?: string | string[]; // Single language code or array of enabled language codes (e.g., 'en' or ['en', 'fr'])
  /** Layout mode: 'sidebar' (default) or 'fullscreen'. Fullscreen shows only content with no navigation. */
  layout?: LayoutType;
  /** When set, opening the app at "/" redirects to this path (e.g. "/playground"). */
  start_url?: string;
  navigation?: (NavigationItem | NavigationGroup)[];
  themes?: ThemeDefinition[]; // Custom themes to register
  defaultTheme?: string; // Default theme name to use
  /** Sentry error reporting. Load from env (e.g. SENTRY_DSN). Only active in production builds. */
  sentry?: SentryConfig;
  /** Cookie consent: list of cookies by category; accepted ids are stored in settings. */
  cookieConsent?: CookieConsentConfig;
}
