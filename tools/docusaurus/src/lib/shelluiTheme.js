import {shellui} from '@shellui/sdk';

export function isShelluiEmbedded() {
  return typeof window !== 'undefined' && window.parent !== window;
}

/** @param {'light' | 'dark' | 'system'} colorScheme */
export function colorSchemeToColorMode(colorScheme) {
  if (colorScheme === 'dark') return 'dark';
  if (colorScheme === 'light') return 'light';
  return null;
}

/** @param {'light' | 'dark' | null} colorModeChoice */
export function colorModeToColorScheme(colorModeChoice) {
  if (colorModeChoice === 'dark') return 'dark';
  if (colorModeChoice === 'light') return 'light';
  return 'system';
}

/** @param {'light' | 'dark' | 'system'} colorScheme */
export function sendColorSchemeToShell(colorScheme) {
  if (!isShelluiEmbedded() || !shellui.initialSettings) {
    return;
  }

  const nextSettings = {
    ...shellui.initialSettings,
    appearance: {
      ...(shellui.initialSettings.appearance ?? {}),
      colorScheme,
    },
  };

  shellui.sendMessageToParent({
    type: 'SHELLUI_SETTINGS_UPDATED',
    payload: {settings: nextSettings},
  });
}
