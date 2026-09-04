import {useEffect, useRef} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import {shellui} from '@shellui/sdk';
import {
  colorSchemeToColorMode,
  isShelluiEmbedded,
} from '../../lib/shelluiTheme';

function applyAppearanceColorScheme(appearance, colorModeChoice, setColorMode) {
  const colorScheme = appearance?.colorScheme ?? 'system';
  const selected = colorModeChoice === null ? 'system' : colorModeChoice;
  if (selected === colorScheme) {
    return;
  }
  setColorMode(colorSchemeToColorMode(colorScheme), {persist: false});
}

export default function ShelluiThemeSync() {
  const {colorModeChoice, setColorMode} = useColorMode();
  const colorModeChoiceRef = useRef(colorModeChoice);
  colorModeChoiceRef.current = colorModeChoice;

  useEffect(() => {
    if (!isShelluiEmbedded()) {
      return undefined;
    }

    let cancelled = false;
    const cleanups = [];

    void shellui.init().then(() => {
      if (cancelled) {
        return;
      }

      const applyFromSettings = (settings) => {
        applyAppearanceColorScheme(
          settings?.appearance,
          colorModeChoiceRef.current,
          setColorMode,
        );
      };

      if (shellui.initialSettings) {
        applyFromSettings(shellui.initialSettings);
      }

      cleanups.push(
        shellui.addMessageListener('SHELLUI_SETTINGS', (message) => {
          applyFromSettings(message.payload?.settings);
        }),
      );
      cleanups.push(
        shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (message) => {
          applyFromSettings(message.payload?.settings);
        }),
      );
    });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [setColorMode]);

  return null;
}
