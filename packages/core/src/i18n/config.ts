import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './translations/en/common.json';
import enSettings from './translations/en/settings.json';
import frCommon from './translations/fr/common.json';
import frSettings from './translations/fr/settings.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['code'];

const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
  },
  fr: {
    common: frCommon,
    settings: frSettings,
  },
};

// Get initial language from localStorage if available
const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('shellui:settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        const languageCode = parsed.language?.code;
        if (languageCode && supportedLanguages.some(lang => lang.code === languageCode)) {
          return languageCode;
        }
      }
    } catch (error) {
      // Ignore errors, fall back to default
    }
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'common',
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: supportedLanguages.map(lang => lang.code),
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better PWA compatibility
    },
  });

export default i18n;
