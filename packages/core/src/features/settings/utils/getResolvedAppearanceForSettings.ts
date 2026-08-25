import type { Appearance, Settings } from '@shellui/sdk';
import { getTheme, setAvailableThemes, defaultTheme } from '../../theme/themes';
import type { ShellUIConfig, ThemeDefinition } from '../../config/types';
import { resolveColorMode } from './resolveColorMode';
import { toAbsoluteFontUrls } from './toAbsoluteFontUrls';

/**
 * Build the full appearance object for settings propagation so apps receive all theme
 * variable values and can style without knowing the theme name.
 */
export const getResolvedAppearanceForSettings = (
  settings: Settings,
  config: ShellUIConfig | undefined,
): Appearance | undefined => {
  if (typeof window === 'undefined') return undefined;

  const available: ThemeDefinition[] =
    config?.themes && Array.isArray(config.themes) && config.themes.length > 0
      ? (config.themes as ThemeDefinition[])
      : [defaultTheme];
  setAvailableThemes(available);

  const themeName =
    settings.appearance?.name || config?.activeTheme || config?.defaultTheme || defaultTheme.name;
  const themeDef = getTheme(themeName) || getTheme(defaultTheme.name);
  if (!themeDef) return undefined;

  const colorScheme = settings.appearance?.colorScheme ?? 'system';
  const mode = resolveColorMode(colorScheme);

  return {
    name: themeDef.name,
    displayName: themeDef.displayName,
    mode,
    colorScheme,
    colors: themeDef.colors,
    ...(themeDef.fontFamily !== undefined && { fontFamily: themeDef.fontFamily }),
    ...(themeDef.bodyFontFamily !== undefined && {
      bodyFontFamily: themeDef.bodyFontFamily,
    }),
    ...(themeDef.headingFontFamily !== undefined && {
      headingFontFamily: themeDef.headingFontFamily,
    }),
    ...(themeDef.letterSpacing !== undefined && {
      letterSpacing: themeDef.letterSpacing,
    }),
    ...(themeDef.textShadow !== undefined && { textShadow: themeDef.textShadow }),
    ...(themeDef.lineHeight !== undefined && { lineHeight: themeDef.lineHeight }),
    ...(themeDef.fontFiles !== undefined &&
      themeDef.fontFiles.length > 0 && {
        fontFiles: toAbsoluteFontUrls(themeDef.fontFiles),
      }),
  };
};
