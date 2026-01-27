/**
 * Theme color definitions following shadcn/ui CSS variable structure
 * Each theme has light and dark mode variants
 * Colors are stored in hex format (e.g., "#4CAF50" or "4CAF50")
 * and converted to HSL when applied to CSS variables
 */

/**
 * Convert hex color (format: "#RRGGBB" or "RRGGBB") to HSL string (format: "H S% L%")
 */
function hexToHsl(hexString: string): string {
  // Handle non-color values like radius
  if (!hexString || typeof hexString !== 'string') {
    return hexString;
  }
  
  // Check if it's a hex color
  if (!hexString.match(/^#?[0-9A-Fa-f]{6}$/)) {
    // If it's not a hex color, return as-is (might be radius or other value)
    return hexString;
  }

  // Remove # if present
  const hex = hexString.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Validate parsed values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn(`[Theme] Invalid hex color: ${hexString}`);
    return hexString;
  }
  
  // Normalize RGB values to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }

  // Convert to degrees and percentages
  const hDeg = Math.round(h * 360 * 10) / 10; // Keep one decimal for precision
  const sPercent = Math.round(s * 100 * 10) / 10;
  const lPercent = Math.round(l * 100 * 10) / 10;

  const result = `${hDeg} ${sPercent}% ${lPercent}%`;
  
  // Validate result
  if (!result.match(/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/)) {
    console.warn(`[Theme] Invalid HSL conversion result for ${hexString}: ${result}`);
    return hexString;
  }
  
  return result;
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
}

/**
 * Default theme - Green (current ShellUI theme)
 * Colors are in hex format (e.g., "#FFFFFF" or "FFFFFF" for white)
 */
export const defaultTheme: ThemeDefinition = {
  name: 'default',
  displayName: 'Default',
  colors: {
    light: {
      background: '#FFFFFF', // White
      foreground: '#020617', // Very dark blue-gray
      card: '#FFFFFF', // White
      cardForeground: '#020617', // Very dark blue-gray
      popover: '#FFFFFF', // White
      popoverForeground: '#020617', // Very dark blue-gray
      primary: '#22C55E', // Green
      primaryForeground: '#FFFFFF', // White
      secondary: '#F1F5F9', // Light gray-blue
      secondaryForeground: '#0F172A', // Dark blue-gray
      muted: '#F1F5F9', // Light gray-blue
      mutedForeground: '#64748B', // Medium gray-blue
      accent: '#F1F5F9', // Light gray-blue
      accentForeground: '#0F172A', // Dark blue-gray
      destructive: '#EF4444', // Red
      destructiveForeground: '#F8FAFC', // Off-white
      border: '#E2E8F0', // Light gray
      input: '#E2E8F0', // Light gray
      ring: '#020617', // Very dark blue-gray
      radius: '0.5rem',
      sidebarBackground: '#FAFAFA', // Off-white
      sidebarForeground: '#334155', // Dark gray-blue
      sidebarPrimary: '#0F172A', // Very dark blue-gray
      sidebarPrimaryForeground: '#FAFAFA', // Off-white
      sidebarAccent: '#F4F4F5', // Light gray
      sidebarAccentForeground: '#0F172A', // Very dark blue-gray
      sidebarBorder: '#E2E8F0', // Light gray
      sidebarRing: '#3B82F6', // Blue
    },
    dark: {
      background: '#020617', // Very dark blue-gray
      foreground: '#F8FAFC', // Off-white
      card: '#020617', // Very dark blue-gray
      cardForeground: '#F8FAFC', // Off-white
      popover: '#020617', // Very dark blue-gray
      popoverForeground: '#F8FAFC', // Off-white
      primary: '#4ADE80', // Bright green
      primaryForeground: '#FFFFFF', // White
      secondary: '#1E293B', // Dark blue-gray
      secondaryForeground: '#F8FAFC', // Off-white
      muted: '#1E293B', // Dark blue-gray
      mutedForeground: '#94A3B8', // Medium gray-blue
      accent: '#1E293B', // Dark blue-gray
      accentForeground: '#F8FAFC', // Off-white
      destructive: '#991B1B', // Dark red
      destructiveForeground: '#F8FAFC', // Off-white
      border: '#1E293B', // Dark blue-gray
      input: '#1E293B', // Dark blue-gray
      ring: '#CBD5E1', // Light gray-blue
      radius: '0.5rem',
      sidebarBackground: '#0F172A', // Very dark blue-gray
      sidebarForeground: '#F1F5F9', // Light gray-blue
      sidebarPrimary: '#E0E7FF', // Very light blue
      sidebarPrimaryForeground: '#0F172A', // Very dark blue-gray
      sidebarAccent: '#18181B', // Very dark gray
      sidebarAccentForeground: '#F1F5F9', // Light gray-blue
      sidebarBorder: '#18181B', // Very dark gray
      sidebarRing: '#3B82F6', // Blue
    },
  },
};

/**
 * Blue theme
 * Colors are in hex format (e.g., "#FFFFFF" or "FFFFFF" for white)
 */
export const blueTheme: ThemeDefinition = {
  name: 'blue',
  displayName: 'Blue',
  colors: {
    light: {
      background: '#FFFFFF', // White
      foreground: '#020617', // Very dark blue-gray
      card: '#FFFFFF', // White
      cardForeground: '#020617', // Very dark blue-gray
      popover: '#FFFFFF', // White
      popoverForeground: '#020617', // Very dark blue-gray
      primary: '#3B82F6', // Blue
      primaryForeground: '#0F172A', // Dark blue-gray
      secondary: '#F1F5F9', // Light gray-blue
      secondaryForeground: '#0F172A', // Dark blue-gray
      muted: '#F1F5F9', // Light gray-blue
      mutedForeground: '#64748B', // Medium gray-blue
      accent: '#F1F5F9', // Light gray-blue
      accentForeground: '#0F172A', // Dark blue-gray
      destructive: '#EF4444', // Red
      destructiveForeground: '#F8FAFC', // Off-white
      border: '#E2E8F0', // Light gray
      input: '#E2E8F0', // Light gray
      ring: '#3B82F6', // Blue
      radius: '0.5rem',
      sidebarBackground: '#FAFAFA', // Off-white
      sidebarForeground: '#334155', // Dark gray-blue
      sidebarPrimary: '#3B82F6', // Blue
      sidebarPrimaryForeground: '#FFFFFF', // White
      sidebarAccent: '#F4F4F5', // Light gray
      sidebarAccentForeground: '#0F172A', // Very dark blue-gray
      sidebarBorder: '#E2E8F0', // Light gray
      sidebarRing: '#3B82F6', // Blue
    },
    dark: {
      background: '#020617', // Very dark blue-gray
      foreground: '#F8FAFC', // Off-white
      card: '#020617', // Very dark blue-gray
      cardForeground: '#F8FAFC', // Off-white
      popover: '#020617', // Very dark blue-gray
      popoverForeground: '#F8FAFC', // Off-white
      primary: '#3B82F6', // Blue
      primaryForeground: '#0F172A', // Dark blue-gray
      secondary: '#1E293B', // Dark blue-gray
      secondaryForeground: '#F8FAFC', // Off-white
      muted: '#1E293B', // Dark blue-gray
      mutedForeground: '#94A3B8', // Medium gray-blue
      accent: '#1E293B', // Dark blue-gray
      accentForeground: '#F8FAFC', // Off-white
      destructive: '#991B1B', // Dark red
      destructiveForeground: '#F8FAFC', // Off-white
      border: '#1E293B', // Dark blue-gray
      input: '#1E293B', // Dark blue-gray
      ring: '#3B82F6', // Blue
      radius: '0.5rem',
      sidebarBackground: '#0F172A', // Very dark blue-gray
      sidebarForeground: '#F1F5F9', // Light gray-blue
      sidebarPrimary: '#3B82F6', // Blue
      sidebarPrimaryForeground: '#0F172A', // Dark blue-gray
      sidebarAccent: '#18181B', // Very dark gray
      sidebarAccentForeground: '#F1F5F9', // Light gray-blue
      sidebarBorder: '#18181B', // Very dark gray
      sidebarRing: '#3B82F6', // Blue
    },
  },
};

/**
 * Registry of all available themes
 */
const themeRegistry = new Map<string, ThemeDefinition>([
  ['default', defaultTheme],
  ['blue', blueTheme],
]);

/**
 * Register a custom theme
 */
export function registerTheme(theme: ThemeDefinition): void {
  themeRegistry.set(theme.name, theme);
}

/**
 * Get a theme by name
 */
export function getTheme(name: string): ThemeDefinition | undefined {
  return themeRegistry.get(name);
}

/**
 * Get all available themes
 */
export function getAllThemes(): ThemeDefinition[] {
  return Array.from(themeRegistry.values());
}

/**
 * Apply theme colors to the document
 * Converts hex format colors to HSL format for CSS variables
 * Sets variables directly on :root to ensure they override CSS defaults
 */
export function applyTheme(theme: ThemeDefinition, isDark: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const colors = isDark ? theme.colors.dark : theme.colors.light;

  // Convert hex to HSL for all colors
  const primaryHsl = hexToHsl(colors.primary);
  
  // Apply CSS variables directly on :root element
  // Inline styles have the highest specificity and will override CSS defaults
  // Format: HSL values without hsl() wrapper (e.g., "142 71% 45%")
  root.style.setProperty('--background', hexToHsl(colors.background));
  root.style.setProperty('--foreground', hexToHsl(colors.foreground));
  root.style.setProperty('--card', hexToHsl(colors.card));
  root.style.setProperty('--card-foreground', hexToHsl(colors.cardForeground));
  root.style.setProperty('--popover', hexToHsl(colors.popover));
  root.style.setProperty('--popover-foreground', hexToHsl(colors.popoverForeground));
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--primary-foreground', hexToHsl(colors.primaryForeground));
  root.style.setProperty('--secondary', hexToHsl(colors.secondary));
  root.style.setProperty('--secondary-foreground', hexToHsl(colors.secondaryForeground));
  root.style.setProperty('--muted', hexToHsl(colors.muted));
  root.style.setProperty('--muted-foreground', hexToHsl(colors.mutedForeground));
  root.style.setProperty('--accent', hexToHsl(colors.accent));
  root.style.setProperty('--accent-foreground', hexToHsl(colors.accentForeground));
  root.style.setProperty('--destructive', hexToHsl(colors.destructive));
  root.style.setProperty('--destructive-foreground', hexToHsl(colors.destructiveForeground));
  root.style.setProperty('--border', hexToHsl(colors.border));
  root.style.setProperty('--input', hexToHsl(colors.input));
  root.style.setProperty('--ring', hexToHsl(colors.ring));
  root.style.setProperty('--radius', colors.radius); // radius is not a color
  root.style.setProperty('--sidebar-background', hexToHsl(colors.sidebarBackground));
  root.style.setProperty('--sidebar-foreground', hexToHsl(colors.sidebarForeground));
  root.style.setProperty('--sidebar-primary', hexToHsl(colors.sidebarPrimary));
  root.style.setProperty('--sidebar-primary-foreground', hexToHsl(colors.sidebarPrimaryForeground));
  root.style.setProperty('--sidebar-accent', hexToHsl(colors.sidebarAccent));
  root.style.setProperty('--sidebar-accent-foreground', hexToHsl(colors.sidebarAccentForeground));
  root.style.setProperty('--sidebar-border', hexToHsl(colors.sidebarBorder));
  root.style.setProperty('--sidebar-ring', hexToHsl(colors.sidebarRing));
  
  // Verify primary color is set (for debugging)
  const actualPrimary = root.style.getPropertyValue('--primary');
  const computedPrimary = getComputedStyle(root).getPropertyValue('--primary');
  
  // Validate HSL format (should be "H S% L%" like "142 71% 45%")
  const hslFormat = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;
  
  if (!actualPrimary || actualPrimary.trim() === '') {
    console.error(`[Theme] Failed to set --primary CSS variable. Expected HSL from ${colors.primary}, got: "${actualPrimary}"`);
  } else if (!hslFormat.test(actualPrimary.trim())) {
    console.error(`[Theme] Invalid HSL format for --primary: "${actualPrimary}". Expected format: "H S% L%"`);
  } else {
    // Log successful setting for debugging (only in dev mode)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Theme] Set --primary to: "${actualPrimary}" (computed: "${computedPrimary}")`);
    }
  }
  
  // Force a reflow to ensure Tailwind picks up the changes
  // This is sometimes needed for Tailwind v4 to recognize CSS variable changes
  void root.offsetHeight;
}
