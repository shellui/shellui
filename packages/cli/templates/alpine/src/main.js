import Alpine from 'alpinejs';
import { shellui } from '@shellui/sdk/tiny';
import { normalizeLang, t } from './i18n';
import './style.css';

/**
 * Shellui host sync for Alpine — mirrors the React starter’s useShellui pattern:
 * ready → applyTheme + language; subscribe to theme / language events.
 */
function shelluiHome() {
  return {
    language: normalizeLang(shellui.language),
    theme: shellui.theme,

    init() {
      const applyTheme = () => {
        shellui.applyTheme();
        this.theme = shellui.theme;
      };
      const applyLanguage = (code) => {
        this.language = normalizeLang(code);
        document.documentElement.lang = this.language;
      };

      void shellui.ready.then(() => {
        applyTheme();
        applyLanguage(shellui.language);
      });

      this._offTheme = shellui.on('theme', applyTheme);
      this._offLanguage = shellui.on('language', applyLanguage);
    },

    destroy() {
      this._offTheme?.();
      this._offLanguage?.();
    },

    t(key) {
      return t(this.language, key);
    },

    get themeLabel() {
      const theme = this.theme;
      if (!theme) return this.t('fallbackTheme');
      const name = theme.displayName || theme.name || 'shellui';
      return `${name} · ${theme.mode || 'light'}`;
    },

    get languageLabel() {
      return shellui.language == null ? this.t('fallbackLanguage') : this.language;
    },
  };
}

window.Alpine = Alpine;
Alpine.data('shelluiHome', shelluiHome);
Alpine.start();
