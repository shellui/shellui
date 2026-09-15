export type AppLang = 'en' | 'fr';

export const messages: Record<AppLang, Record<string, string>> = {
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
    title: 'Bienvenue dans Shellui',
    blurb:
      'Cette application compagnon est intégrée dans la coque Shellui. Elle suit le thème et la langue de la coque dès le départ.',
    themeLabel: 'Thème',
    languageLabel: 'Langue',
    hint: 'Ouvrez les Paramètres de la coque (engrenage) et changez le thème ou la langue — cette page se met à jour avec la coque.',
    fallbackTheme: 'par défaut (autonome)',
    fallbackLanguage: 'en (autonome)',
  },
};

export function normalizeLang(code: string | null | undefined): AppLang {
  return code === 'fr' ? 'fr' : 'en';
}
