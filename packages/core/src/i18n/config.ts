import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './translations/en/common.json';
import enSettings from './translations/en/settings.json';
import enCookieConsent from './translations/en/cookieConsent.json';
import frCommon from './translations/fr/common.json';
import frSettings from './translations/fr/settings.json';
import frCookieConsent from './translations/fr/cookieConsent.json';

export const allSupportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
] as const;

export type SupportedLanguage = typeof allSupportedLanguages[number]['code'];

const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
    cookieConsent: enCookieConsent,
  },
  fr: {
    common: frCommon,
    settings: frSettings,
    cookieConsent: frCookieConsent,
  },
};

// Get initial language from localStorage if available
const getInitialLanguage = (enabledLanguages: string[]): SupportedLanguage => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('shellui:settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        const languageCode = parsed.language?.code;
        // Only use stored language if it's in the enabled languages list
        if (languageCode && enabledLanguages.includes(languageCode)) {
          return languageCode as SupportedLanguage;
        }
      }
    } catch (_error) {
      // Ignore errors, fall back to default
    }
  }
  // Fallback to first enabled language or 'en'
  return (enabledLanguages[0] || 'en') as SupportedLanguage;
};

// Initialize i18n with default settings (will be updated when config loads)
let isInitialized = false;

export const initializeI18n = (enabledLanguages?: string | string[]) => {
  // Normalize to array
  const enabledLangs = enabledLanguages 
    ? (Array.isArray(enabledLanguages) ? enabledLanguages : [enabledLanguages])
    : allSupportedLanguages.map(lang => lang.code);
  
  // Filter to only include languages we have translations for
  const validLangs = enabledLangs.filter(lang => 
    allSupportedLanguages.some(supported => supported.code === lang)
  );
  
  // Ensure at least 'en' is available
  const finalLangs = validLangs.length > 0 ? validLangs : ['en'];
  const initialLang = getInitialLanguage(finalLangs);

  if (!isInitialized) {
    i18n
      .use(initReactI18next)
      .init({
        resources,
        defaultNS: 'common',
        lng: initialLang,
        fallbackLng: 'en',
        supportedLngs: finalLangs,
        interpolation: {
          escapeValue: false, // React already escapes values
        },
        react: {
          useSuspense: false, // Disable suspense for better PWA compatibility
        },
      });
    isInitialized = true;
  } else {
    // Update supported languages if config changes
    i18n.changeLanguage(initialLang);
  }

  return finalLangs;
};

// Initialize with all languages by default (will be filtered when config loads)
initializeI18n();

export const getSupportedLanguages = (enabledLanguages?: string | string[]) => {
  const enabledLangs = enabledLanguages 
    ? (Array.isArray(enabledLanguages) ? enabledLanguages : [enabledLanguages])
    : allSupportedLanguages.map(lang => lang.code);
  
  return allSupportedLanguages.filter(lang => enabledLangs.includes(lang.code));
};

export default i18n;
