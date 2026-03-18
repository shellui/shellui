import type { Settings } from '@shellui/sdk';

export type AppPreferences = {
  themeName?: string;
  language?: string;
  region?: string;
  colorScheme?: 'light' | 'dark' | 'system';
};

export const mergePreferencesIntoSettings = (
  currentSettings: Settings,
  preferences: AppPreferences,
): Settings => {
  const hasThemeName =
    typeof preferences.themeName === 'string' && preferences.themeName.trim() !== '';
  const hasLanguage =
    typeof preferences.language === 'string' && preferences.language.trim() !== '';
  const hasRegion = typeof preferences.region === 'string' && preferences.region.trim() !== '';
  const hasColorScheme =
    preferences.colorScheme === 'light' ||
    preferences.colorScheme === 'dark' ||
    preferences.colorScheme === 'system';
  const normalizedColorScheme: 'light' | 'dark' | 'system' = hasColorScheme
    ? preferences.colorScheme
    : currentSettings.appearance.colorScheme;
  const normalizedLanguage =
    preferences.language === 'fr' || preferences.language === 'en'
      ? preferences.language
      : currentSettings.language.code;

  return {
    ...currentSettings,
    appearance: {
      ...currentSettings.appearance,
      ...(hasThemeName ? { name: preferences.themeName?.trim() } : {}),
      colorScheme: normalizedColorScheme,
    },
    language: {
      ...currentSettings.language,
      ...(hasLanguage ? { code: normalizedLanguage } : {}),
    },
    region: {
      ...currentSettings.region,
      ...(hasRegion ? { timezone: preferences.region?.trim() } : {}),
    },
  };
};
