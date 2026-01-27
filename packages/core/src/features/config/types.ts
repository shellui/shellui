// Language-specific label/title
export type LocalizedString = string | {
  en: string;
  fr: string;
  [key: string]: string; // Allow other language codes
};

export interface NavigationItem {
  label: string | LocalizedString;
  path: string;
  url: string;
  icon?: string; // Path to SVG icon file (e.g., '/icons/book-open.svg')
}

export interface NavigationGroup {
  title: string | LocalizedString;
  items: NavigationItem[];
}

export interface ShellUIConfig {
  port?: number;
  title?: string;
  language?: string | string[]; // Single language code or array of enabled language codes (e.g., 'en' or ['en', 'fr'])
  navigation?: (NavigationItem | NavigationGroup)[];
}
