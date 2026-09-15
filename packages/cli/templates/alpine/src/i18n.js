/** Minimal en/fr catalogs — follows shell language via @shellui/sdk/tiny. */

export const messages = {
  en: {
    title: 'Welcome to Shellui',
    blurb:
      'This companion app is embedded in the Shellui shell. It follows the shell theme and language out of the box.',
    themeLabel: 'Theme',
    languageLabel: 'Language',
    hint: 'Open Shell Settings (gear) and change theme or language — this page updates with the shell.',
    fallbackTheme: 'default (standalone)',
    fallbackLanguage: 'en (standalone)',
  },
  fr: {
    title: 'Bienvenue sur Shellui',
    blurb:
      'Cette application compagnon est intégrée dans le shell Shellui. Elle suit le thème et la langue du shell dès le départ.',
    themeLabel: 'Thème',
    languageLabel: 'Langue',
    hint: 'Ouvrez les paramètres du shell (engrenage) et changez le thème ou la langue — cette page se met à jour avec le shell.',
    fallbackTheme: 'par défaut (autonome)',
    fallbackLanguage: 'en (autonome)',
  },
};

/** @param {string | null | undefined} code */
export function normalizeLang(code) {
  return code === 'fr' ? 'fr' : 'en';
}

/**
 * @param {string | null | undefined} code
 * @param {keyof typeof messages.en} key
 */
export function t(code, key) {
  const lang = normalizeLang(code);
  return messages[lang][key] ?? messages.en[key] ?? key;
}
