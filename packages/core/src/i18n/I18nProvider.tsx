import * as React from 'react';
import { useSettings } from '../features/settings/SettingsContext';
import { initializeI18n } from './config';
import i18n from './config';
import type { ShellUIConfig } from '../features/config/types';

interface I18nProviderProps {
  children: React.ReactNode;
  config?: ShellUIConfig;
}

export function I18nProvider({ children, config }: I18nProviderProps) {
  const { settings } = useSettings();
  const currentLanguage = settings.language?.code || 'en';

  // Initialize i18n with enabled languages from config
  React.useEffect(() => {
    if (config?.language) {
      initializeI18n(config.language);
    }
  }, [config?.language]);

  // Sync i18n language with settings changes
  React.useEffect(() => {
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  return <>{children}</>;
}
