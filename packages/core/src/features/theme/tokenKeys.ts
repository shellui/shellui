/**
 * Map CSS-variable kebab keys onto ThemeColorsMode camelCase.
 */
const KEBAB_TO_CAMEL: Record<string, string> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  'card-foreground': 'cardForeground',
  popover: 'popover',
  'popover-foreground': 'popoverForeground',
  primary: 'primary',
  'primary-foreground': 'primaryForeground',
  secondary: 'secondary',
  'secondary-foreground': 'secondaryForeground',
  muted: 'muted',
  'muted-foreground': 'mutedForeground',
  accent: 'accent',
  'accent-foreground': 'accentForeground',
  destructive: 'destructive',
  'destructive-foreground': 'destructiveForeground',
  border: 'border',
  input: 'input',
  ring: 'ring',
  radius: 'radius',
  sidebar: 'sidebarBackground',
  'sidebar-background': 'sidebarBackground',
  'sidebar-foreground': 'sidebarForeground',
  'sidebar-primary': 'sidebarPrimary',
  'sidebar-primary-foreground': 'sidebarPrimaryForeground',
  'sidebar-accent': 'sidebarAccent',
  'sidebar-accent-foreground': 'sidebarAccentForeground',
  'sidebar-border': 'sidebarBorder',
  'sidebar-ring': 'sidebarRing',
  'chart-1': 'chart1',
  'chart-2': 'chart2',
  'chart-3': 'chart3',
  'chart-4': 'chart4',
  'chart-5': 'chart5',
  chart1: 'chart1',
  chart2: 'chart2',
  chart3: 'chart3',
  chart4: 'chart4',
  chart5: 'chart5',
};

/**
 * Normalize a light/dark token bag (camelCase or kebab-case) to camelCase partial.
 */
export function normalizeTokenKeys(
  input: Record<string, unknown> | undefined | null,
): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value === '') continue;
    const camel = KEBAB_TO_CAMEL[key] || key;
    out[camel] = value;
  }
  return out;
}
