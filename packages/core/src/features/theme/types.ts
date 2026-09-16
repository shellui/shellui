/**
 * Theme types for Shellui (shadcn/ui CSS variable structure).
 * Color values: prefer hex (`#RRGGBB`). HSL channel triples and OKLCH strings are also accepted.
 */

/** Current theme JSON / object schema version. */
export const THEME_SCHEMA_VERSION = 1 as const;

/** Color tokens for one mode (light or dark). */
export interface ThemeColorsMode {
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
  /** Optional chart series colors (shadcn chart tokens). */
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
}

/** Partial token overrides when extending a base theme. */
export type ThemeColorsModePartial = Partial<ThemeColorsMode>;

export interface ThemeColors {
  light: ThemeColorsMode;
  dark: ThemeColorsMode;
}

/** Optional font packaging for a theme. */
export interface ThemeFonts {
  /** Sans / UI font stack */
  sans?: string;
  /** Monospace font stack */
  mono?: string;
  /** Serif font stack */
  serif?: string;
  /** Heading font stack (falls back to sans) */
  heading?: string;
  /** Body font stack (falls back to sans) */
  body?: string;
  /**
   * Font file URLs or paths (Google Fonts CSS, local `.css`, or `.woff2`).
   * Paths in theme JSON are relative to the theme file / themesDir.
   */
  files?: string[];
}

/**
 * Normalized runtime theme (always complete light + dark palettes).
 */
export interface ThemeDefinition {
  name: string;
  displayName: string;
  description?: string;
  /** Highlight in the selector when many themes are available. */
  recommended?: boolean;
  colors: ThemeColors;
  fontFamily?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  fontFiles?: string[];
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string;
}

/**
 * Flexible theme object for config or theme JSON files.
 * Supports compact (`light`/`dark` + `label`) and legacy (`colors` + `displayName`) shapes.
 * Partial light/dark tokens are merged onto the default theme.
 */
export interface ThemeInput {
  /**
   * Theme JSON schema version. Required in theme folder JSON files (must be 1).
   * Optional for inline config objects.
   */
  version?: typeof THEME_SCHEMA_VERSION | number;
  /** JSON Schema URL for editor tooling (theme JSON files). */
  $schema?: string;
  name?: string;
  /** Human-readable label (preferred). */
  label?: string;
  /** @deprecated Prefer `label`. Kept for existing configs. */
  displayName?: string;
  description?: string;
  recommended?: boolean;
  fonts?: ThemeFonts;
  fontFamily?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  fontFiles?: string[];
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string;
  /** Shared radius applied to both modes when mode tokens omit `radius`. */
  radius?: string;
  light?: ThemeColorsModePartial;
  dark?: ThemeColorsModePartial;
  /** Legacy full colors object (required keys when used as a complete theme). */
  colors?: {
    light: ThemeColorsModePartial;
    dark: ThemeColorsModePartial;
  };
}

/** Built-in name, filesystem path, or inline theme object. */
export type ThemeRef = string | ThemeInput | ThemeDefinition;

/** Array of refs, or map of id → ref (id used as name when the ref is a string/path). */
export type ThemesConfig = ThemeRef[] | Record<string, ThemeRef>;

/** Keys that must be present on a complete ThemeColorsMode. */
export const THEME_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'border',
  'input',
  'ring',
  'radius',
  'sidebarBackground',
  'sidebarForeground',
  'sidebarPrimary',
  'sidebarPrimaryForeground',
  'sidebarAccent',
  'sidebarAccentForeground',
  'sidebarBorder',
  'sidebarRing',
] as const satisfies ReadonlyArray<keyof ThemeColorsMode>;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
