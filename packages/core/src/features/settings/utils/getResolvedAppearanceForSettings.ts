import type { Appearance, Settings } from '@shellui/sdk';
import { getTheme, registerTheme } from '../../theme/themes';
import type { ShellUIConfig } from '../../config/types';
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

  config?.themes?.forEach(registerTheme);
  const themeName = settings.appearance?.name || config?.defaultTheme || 'default';
  const themeDef = getTheme(themeName) || getTheme('default');
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
