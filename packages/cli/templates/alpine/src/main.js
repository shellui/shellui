import Alpine from 'alpinejs';
import { shellui } from '@shellui/sdk/tiny';
import { normalizeLang, t } from './i18n';
import './style.css';

/**
 * Shellui host sync for Alpine: after `shellui.ready`, apply the shell theme and
 * language, then keep both in sync via `on('theme'|'language')`.
 * (More than the light `void shellui.ready` handshake in other starters.)
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

      const offTheme = shellui.on('theme', applyTheme);
      const offLanguage = shellui.on('language', applyLanguage);
      // Keep unsubscribers off the reactive proxy; tear down with the element.
      this.$cleanup(() => {
        offTheme();
        offLanguage();
      });
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

// Alpine has no built-in `$cleanup`; expose element teardown for `init()`.
Alpine.magic('cleanup', (_el, { cleanup }) => (fn) => {
  cleanup(fn);
});

Alpine.data('shelluiHome', shelluiHome);
Alpine.start();
