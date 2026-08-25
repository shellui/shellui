import { toCssVarValue } from './color';
import type { ThemeColorsMode, ThemeDefinition } from './types';

const COLOR_VAR_MAP: Array<[keyof ThemeColorsMode, string]> = [
  ['background', '--background'],
  ['foreground', '--foreground'],
  ['card', '--card'],
  ['cardForeground', '--card-foreground'],
  ['popover', '--popover'],
  ['popoverForeground', '--popover-foreground'],
  ['primary', '--primary'],
  ['primaryForeground', '--primary-foreground'],
  ['secondary', '--secondary'],
  ['secondaryForeground', '--secondary-foreground'],
  ['muted', '--muted'],
  ['mutedForeground', '--muted-foreground'],
  ['accent', '--accent'],
  ['accentForeground', '--accent-foreground'],
  ['destructive', '--destructive'],
  ['destructiveForeground', '--destructive-foreground'],
  ['border', '--border'],
  ['input', '--input'],
  ['ring', '--ring'],
  ['sidebarBackground', '--sidebar-background'],
  ['sidebarForeground', '--sidebar-foreground'],
  ['sidebarPrimary', '--sidebar-primary'],
  ['sidebarPrimaryForeground', '--sidebar-primary-foreground'],
  ['sidebarAccent', '--sidebar-accent'],
  ['sidebarAccentForeground', '--sidebar-accent-foreground'],
  ['sidebarBorder', '--sidebar-border'],
  ['sidebarRing', '--sidebar-ring'],
  ['chart1', '--chart-1'],
  ['chart2', '--chart-2'],
  ['chart3', '--chart-3'],
  ['chart4', '--chart-4'],
  ['chart5', '--chart-5'],
];

/**
 * Apply theme colors to the document.
 * Sets full CSS colors (OKLCH / hex / hsl()) on :root for Tailwind `var(--*)` consumption.
 */
export function applyTheme(theme: ThemeDefinition, isDark: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const colors = isDark ? theme.colors.dark : theme.colors.light;

  for (const [key, cssVar] of COLOR_VAR_MAP) {
    const value = colors[key];
    if (value == null || value === '') continue;
    const cssValue = toCssVarValue(value);
    root.style.setProperty(cssVar, cssValue);
    // CSS-variable alias: --sidebar mirrors --sidebar-background
    if (key === 'sidebarBackground') {
      root.style.setProperty('--sidebar', cssValue);
    }
  }

  root.style.setProperty('--radius', colors.radius);

  const head = document.head || document.getElementsByTagName('head')[0];
  const existingFontLinks = head.querySelectorAll('link[data-theme-font], style[data-theme-font]');
  existingFontLinks.forEach((link) => link.remove());

  if (theme.fontFiles && theme.fontFiles.length > 0) {
    theme.fontFiles.forEach((fontFile, index) => {
      if (fontFile.includes('fonts.googleapis.com') || fontFile.endsWith('.css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontFile;
        link.setAttribute('data-theme-font', theme.name);
        head.appendChild(link);
      } else {
        const style = document.createElement('style');
        style.setAttribute('data-theme-font', theme.name);
        const fontName = `ThemeFont-${theme.name}-${index}`;
        style.textContent = `
          @font-face {
            font-family: '${fontName}';
            src: url('${fontFile}') format('woff2');
          }
        `;
        head.appendChild(style);
      }
    });
  }

  const bodyFont = theme.bodyFontFamily || theme.fontFamily;
  const headingFont = theme.headingFontFamily || theme.fontFamily || bodyFont;

  if (bodyFont) {
    root.style.setProperty('--body-font-family', bodyFont);
    root.style.setProperty('--font-family', bodyFont);
    document.body.style.fontFamily = bodyFont;
  } else {
    root.style.removeProperty('--body-font-family');
    root.style.removeProperty('--font-family');
    document.body.style.fontFamily = '';
  }

  if (headingFont) {
    root.style.setProperty('--heading-font-family', headingFont);
  } else {
    root.style.removeProperty('--heading-font-family');
  }

  if (theme.letterSpacing) {
    root.style.setProperty('--letter-spacing', theme.letterSpacing);
    root.style.letterSpacing = theme.letterSpacing;
  } else {
    root.style.removeProperty('--letter-spacing');
    root.style.letterSpacing = '';
  }

  if (theme.textShadow) {
    root.style.setProperty('--text-shadow', theme.textShadow);
    const bodyShadow = theme.textShadow.replace(/rgba\(([^)]+)\)/, (match, rgba) => {
      const values = rgba.split(',').map((v: string) => v.trim());
      if (values.length === 4) {
        const opacity = parseFloat(values[3]);
        return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${Math.max(0, opacity * 0.8)})`;
      }
      return match;
    });
    document.body.style.textShadow = bodyShadow;
  } else {
    root.style.removeProperty('--text-shadow');
    document.body.style.textShadow = '';
  }

  if (theme.lineHeight) {
    root.style.setProperty('--line-height', theme.lineHeight);
    document.body.style.lineHeight = theme.lineHeight;
  } else {
    root.style.removeProperty('--line-height');
    document.body.style.lineHeight = '';
  }

  void root.offsetHeight;
}
