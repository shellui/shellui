import type { SettingsAvailableTheme } from '@shellui/sdk';
import { getAllThemes } from '../../theme/themes';

/**
 * Map registered themes to the slim shape sent to sub-apps
 * (name, displayName, colors, optional typography for preview).
 */
export const getAvailableThemesForSettings = (): SettingsAvailableTheme[] =>
  getAllThemes().map((theme) => ({
    name: theme.name,
    displayName: theme.displayName,
    colors: theme.colors,
    ...(theme.fontFamily !== undefined && { fontFamily: theme.fontFamily }),
    ...(theme.letterSpacing !== undefined && { letterSpacing: theme.letterSpacing }),
    ...(theme.textShadow !== undefined && { textShadow: theme.textShadow }),
  }));
