// Language-specific label/title
export type LocalizedString = string | {
  en: string;
  fr: string;
  [key: string]: string; // Allow other language codes
};

/** Drawer position when opening a link in a drawer (optional, used when openIn === 'drawer'). */
export type DrawerPosition = 'top' | 'bottom' | 'left' | 'right';

/** Layout mode: 'sidebar' (default) shows navigation sidebar; 'fullscreen' shows only content area; 'windows' shows a taskbar with start menu and multi-window desktop. */
export type LayoutType = 'sidebar' | 'fullscreen' | 'windows';

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

export interface ShellUIConfig {
  port?: number;
  title?: string;
  /** Favicon path (e.g. '/favicon.svg'). Used for the document link rel="icon". */
  favicon?: string;
  /** App icon path (e.g. '/favicon.svg'). Displayed before title/logo in sidebar header. */
  appIcon?: string;
  /** Logo path (e.g. '/logo.svg'). If defined, displayed as image in sidebar header instead of text title. */
  logo?: string;
  language?: string | string[]; // Single language code or array of enabled language codes (e.g., 'en' or ['en', 'fr'])
  /** Layout mode: 'sidebar' (default) or 'fullscreen'. Fullscreen shows only content with no navigation. */
  layout?: LayoutType;
  navigation?: (NavigationItem | NavigationGroup)[];
  themes?: ThemeDefinition[]; // Custom themes to register
  defaultTheme?: string; // Default theme name to use
}
