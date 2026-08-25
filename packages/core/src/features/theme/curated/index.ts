import type { ThemeColorsMode, ThemeDefinition, ThemeInput } from '../types';
import { THEME_COLOR_KEYS } from '../types';
import shelluiJson from './shellui.json';
import claudeJson from './claude.json';
import lightGreenJson from './light-green.json';
import zenInspiredJson from './zen-inspired.json';
import astroVistaJson from './astro-vista.json';

function assertCompleteMode(mode: Record<string, string>, themeName: string): ThemeColorsMode {
  for (const key of THEME_COLOR_KEYS) {
    if (typeof mode[key] !== 'string' || !mode[key]) {
      throw new Error(`Curated theme "${themeName}" is missing color token "${key}"`);
    }
  }
  return mode as ThemeColorsMode;
}

/**
 * Load a complete curated theme JSON into a ThemeDefinition (no merge / no normalize import).
 */
export function themeFromCuratedJson(input: ThemeInput): ThemeDefinition {
  const name = input.name;
  if (!name) throw new Error('Curated theme JSON requires name');
  const light = assertCompleteMode({ ...(input.light as Record<string, string>) }, name);
  const dark = assertCompleteMode({ ...(input.dark as Record<string, string>) }, name);
  const fonts = input.fonts;
  const bodyFontFamily = input.bodyFontFamily || fonts?.body || fonts?.sans || input.fontFamily;
  const headingFontFamily =
    input.headingFontFamily || fonts?.heading || fonts?.sans || input.fontFamily;
  const fontFamily = input.fontFamily || fonts?.sans || bodyFontFamily;
  const fontFiles = input.fontFiles ?? fonts?.files;

  return {
    name,
    displayName: input.label || input.displayName || name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.recommended ? { recommended: true } : {}),
    colors: { light, dark },
    ...(fontFamily ? { fontFamily } : {}),
    ...(bodyFontFamily ? { bodyFontFamily } : {}),
    ...(headingFontFamily ? { headingFontFamily } : {}),
    ...(fontFiles?.length ? { fontFiles: [...fontFiles] } : {}),
    ...(input.letterSpacing ? { letterSpacing: input.letterSpacing } : {}),
    ...(input.textShadow ? { textShadow: input.textShadow } : {}),
    ...(input.lineHeight ? { lineHeight: input.lineHeight } : {}),
  };
}

export const shelluiTheme = themeFromCuratedJson(shelluiJson as ThemeInput);
export const claudeTheme = themeFromCuratedJson(claudeJson as ThemeInput);
export const lightGreenTheme = themeFromCuratedJson(lightGreenJson as ThemeInput);
export const zenInspiredTheme = themeFromCuratedJson(zenInspiredJson as ThemeInput);
export const astroVistaTheme = themeFromCuratedJson(astroVistaJson as ThemeInput);

/**
 * Official default theme (Shellui brand). Also available as `themes.default` for init BC.
 */
export const defaultTheme: ThemeDefinition = shelluiTheme;

const curatedList: ThemeDefinition[] = [
  shelluiTheme,
  claudeTheme,
  lightGreenTheme,
  zenInspiredTheme,
  astroVistaTheme,
];

/**
 * Curated themes keyed by name.
 * `default` aliases `shellui` so existing `theme: "default"` configs keep working.
 */
export const themes: Record<string, ThemeDefinition> = {
  shellui: shelluiTheme,
  default: shelluiTheme,
  claude: claudeTheme,
  'light-green': lightGreenTheme,
  'zen-inspired': zenInspiredTheme,
  'astro-vista': astroVistaTheme,
};

/** Ordered curated theme names (excludes the `default` alias). */
export const themeNames: string[] = curatedList.map((theme) => theme.name);

export const recommendedThemeNames: string[] = curatedList
  .filter((theme) => theme.recommended)
  .map((theme) => theme.name);

export { curatedList as curatedThemes };
