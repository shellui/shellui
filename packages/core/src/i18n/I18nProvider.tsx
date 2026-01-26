import * as React from 'react';
import { useSettings } from '../features/settings/SettingsContext';
import i18n from './config';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const currentLanguage = settings.language?.code || 'en';

  // Sync i18n language with settings changes
  React.useEffect(() => {
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  return <>{children}</>;
}
