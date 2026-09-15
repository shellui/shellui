/**
 * Shared Shellui theme/language state (populated by `plugins/shellui.client.ts`).
 */
export function useShellui() {
  const theme = useState<Record<string, unknown> | null>('shellui-theme', () => null);
  const language = useState<'en' | 'fr'>('shellui-language', () => 'en');
  return { theme, language };
}
