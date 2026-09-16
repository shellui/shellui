import { defaultTheme } from './curated';
import { normalizeTokenKeys } from './tokenKeys';
import {
  THEME_COLOR_KEYS,
  THEME_SCHEMA_VERSION,
  type ThemeColorsMode,
  type ThemeColorsModePartial,
  type ThemeDefinition,
  type ThemeInput,
} from './types';

function isCompleteMode(mode: ThemeColorsModePartial | undefined): mode is ThemeColorsMode {
  if (!mode) return false;
  return THEME_COLOR_KEYS.every((key) => {
    const value = mode[key];
    return typeof value === 'string' && value.length > 0;
  });
}

function mergeMode(
  base: ThemeColorsMode,
  override: ThemeColorsModePartial | undefined,
  radiusFallback?: string,
): ThemeColorsMode {
  const merged: ThemeColorsMode = {
    ...base,
    ...(override ?? {}),
  };
  if (radiusFallback && (!override?.radius || override.radius === '')) {
    merged.radius = radiusFallback;
  }
  return merged;
}

function resolveLabel(input: ThemeInput, fallbackName: string): string {
  return input.label || input.displayName || fallbackName;
}

function resolveName(input: ThemeInput, fallbackName?: string): string {
  if (input.name && input.name.trim()) return input.name.trim();
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  throw new Error('Theme object requires a `name` (or map key / filename).');
}

function asPartial(raw: unknown): ThemeColorsModePartial | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return normalizeTokenKeys(raw as Record<string, unknown>) as ThemeColorsModePartial;
}

/**
 * Normalize a flexible theme input into a complete ThemeDefinition.
 * Partial light/dark tokens merge onto `base` (defaults to the official default theme).
 * Accepts camelCase or CSS-variable kebab-case token keys.
 */
export function normalizeTheme(
  input: ThemeInput | ThemeDefinition,
  options: { name?: string; base?: ThemeDefinition } = {},
): ThemeDefinition {
  const base = options.base ?? defaultTheme;

  // Already a complete ThemeDefinition
  if (
    'colors' in input &&
    input.colors &&
    isCompleteMode(input.colors.light) &&
    isCompleteMode(input.colors.dark) &&
    typeof (input as ThemeDefinition).name === 'string' &&
    typeof (input as ThemeDefinition).displayName === 'string'
  ) {
    const def = input as ThemeDefinition;
    return {
      ...def,
      name: options.name ?? def.name,
      displayName: def.displayName || resolveLabel(input as ThemeInput, def.name),
    };
  }

  const themeInput = input as ThemeInput;

  if (typeof themeInput.version === 'number' && themeInput.version !== THEME_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported theme version ${themeInput.version}. Expected ${THEME_SCHEMA_VERSION}.`,
    );
  }

  const name = resolveName(themeInput, options.name);
  const displayName = resolveLabel(themeInput, name);

  const lightPartial = asPartial(themeInput.light ?? themeInput.colors?.light);
  const darkPartial = asPartial(themeInput.dark ?? themeInput.colors?.dark);

  let light: ThemeColorsMode;
  let dark: ThemeColorsMode;
  if (isCompleteMode(lightPartial) && isCompleteMode(darkPartial)) {
    light = { ...lightPartial };
    dark = { ...darkPartial };
    if (themeInput.radius) {
      light.radius = light.radius || themeInput.radius;
      dark.radius = dark.radius || themeInput.radius;
    }
  } else {
    light = mergeMode(base.colors.light, lightPartial, themeInput.radius);
    dark = mergeMode(base.colors.dark, darkPartial, themeInput.radius);
  }

  const fonts = themeInput.fonts;
  const bodyFontFamily =
    themeInput.bodyFontFamily || fonts?.body || fonts?.sans || themeInput.fontFamily;
  const headingFontFamily =
    themeInput.headingFontFamily || fonts?.heading || fonts?.sans || themeInput.fontFamily;
  const fontFamily = themeInput.fontFamily || fonts?.sans || bodyFontFamily;
  const fontFiles = themeInput.fontFiles ?? fonts?.files;

  return {
    name,
    displayName,
    ...(themeInput.description ? { description: themeInput.description } : {}),
    ...(themeInput.recommended ? { recommended: true } : {}),
    colors: { light, dark },
    ...(fontFamily ? { fontFamily } : {}),
    ...(bodyFontFamily ? { bodyFontFamily } : {}),
    ...(headingFontFamily ? { headingFontFamily } : {}),
    ...(fontFiles?.length ? { fontFiles: [...fontFiles] } : {}),
    ...(themeInput.letterSpacing ? { letterSpacing: themeInput.letterSpacing } : {}),
    ...(themeInput.textShadow ? { textShadow: themeInput.textShadow } : {}),
    ...(themeInput.lineHeight ? { lineHeight: themeInput.lineHeight } : {}),
  };
}

/**
 * Convert a ThemeDefinition to the versioned theme JSON shape (for files / docs).
 */
export function toThemeJson(theme: ThemeDefinition): ThemeInput {
  return {
    version: THEME_SCHEMA_VERSION,
    name: theme.name,
    label: theme.displayName,
    ...(theme.description ? { description: theme.description } : {}),
    ...(theme.recommended ? { recommended: true } : {}),
    ...(theme.fontFamily || theme.bodyFontFamily || theme.headingFontFamily || theme.fontFiles
      ? {
          fonts: {
            ...(theme.fontFamily || theme.bodyFontFamily
              ? { sans: theme.bodyFontFamily || theme.fontFamily }
              : {}),
            ...(theme.headingFontFamily ? { heading: theme.headingFontFamily } : {}),
            ...(theme.bodyFontFamily ? { body: theme.bodyFontFamily } : {}),
            ...(theme.fontFiles?.length ? { files: theme.fontFiles } : {}),
          },
        }
      : {}),
    ...(theme.letterSpacing ? { letterSpacing: theme.letterSpacing } : {}),
    ...(theme.textShadow ? { textShadow: theme.textShadow } : {}),
    ...(theme.lineHeight ? { lineHeight: theme.lineHeight } : {}),
    radius: theme.colors.light.radius,
    light: { ...theme.colors.light },
    dark: { ...theme.colors.dark },
  };
}
