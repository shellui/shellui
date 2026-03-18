import { shellui, type Settings, type SettingsUser } from '@shellui/sdk';

// Retrieves the current user from ShellUI initial settings when available.
export const getUserFromSdkSettings = (): SettingsUser | null => {
  const initialSettings = shellui.initialSettings as Settings | null;
  return initialSettings?.user ?? null;
};
