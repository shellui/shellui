// Language-specific label/title
export type LocalizedString = string | {
  en: string;
  fr: string;
  [key: string]: string; // Allow other language codes
};

export interface NavigationItem {
  label: string | LocalizedString;
  path: string;
  url: string;
  icon?: string; // Path to SVG icon file (e.g., '/icons/book-open.svg')
}

export interface NavigationGroup {
  title: string | LocalizedString;
  items: NavigationItem[];
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
  language?: string | string[]; // Single language code or array of enabled language codes (e.g., 'en' or ['en', 'fr'])
  navigation?: (NavigationItem | NavigationGroup)[];
  themes?: ThemeDefinition[]; // Custom themes to register
  defaultTheme?: string; // Default theme name to use
}
