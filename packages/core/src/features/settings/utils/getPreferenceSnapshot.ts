import type { Settings } from '@shellui/sdk';
import { getBrowserTimezone } from './getBrowserTimezone';
import type { AppPreferences } from './mergePreferencesIntoSettings';

export const getPreferenceSnapshot = (settings: Settings): AppPreferences => ({
  themeName: settings.appearance?.name || 'default',
  language: settings.language?.code || 'en',
  region: settings.region?.timezone || getBrowserTimezone(),
  colorScheme: settings.appearance?.colorScheme || 'system',
});
