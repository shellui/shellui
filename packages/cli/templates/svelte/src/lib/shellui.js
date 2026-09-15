import { language, normalizeLang, theme } from './i18n.js';

/**
 * Client-only Shellui handshake + theme/language sync (tiny SDK).
 * Call from onMount so SSR never evaluates `@shellui/sdk/tiny`.
 * @returns {Promise<() => void>} unsubscribe
 */
export async function startShellui() {
  const { shellui } = await import('@shellui/sdk/tiny');

  const applyTheme = () => {
    shellui.applyTheme();
    theme.set(shellui.theme);
  };

  const applyLanguage = (code) => {
    language.set(normalizeLang(code));
  };

  await shellui.ready;
  applyTheme();
  applyLanguage(shellui.language);

  const offTheme = shellui.on('theme', applyTheme);
  const offLanguage = shellui.on('language', applyLanguage);

  return () => {
    offTheme();
    offLanguage();
  };
}
