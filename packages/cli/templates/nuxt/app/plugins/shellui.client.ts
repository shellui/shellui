import { normalizeLang, type AppLang } from '../i18n';

/**
 * Client-only plugin: Shellui handshake + theme/language sync (tiny SDK).
 */
export default defineNuxtPlugin(async () => {
  const theme = useState<Record<string, unknown> | null>('shellui-theme', () => null);
  const language = useState<AppLang>('shellui-language', () => 'en');

  const { shellui } = await import('@shellui/sdk/tiny');

  const applyTheme = () => {
    shellui.applyTheme();
    theme.value = shellui.theme as Record<string, unknown> | null;
  };

  const applyLanguage = (code: string | null) => {
    language.value = normalizeLang(code);
  };

  await shellui.ready;
  applyTheme();
  applyLanguage(shellui.language);

  shellui.on('theme', applyTheme);
  shellui.on('language', applyLanguage);
});
