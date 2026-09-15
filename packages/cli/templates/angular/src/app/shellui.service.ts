import { Injectable, signal } from '@angular/core';
import { shellui } from '@shellui/sdk/tiny';
import { messages, normalizeLang, type AppLang } from './i18n';

@Injectable({ providedIn: 'root' })
export class ShelluiService {
  readonly theme = signal(shellui.theme);
  readonly language = signal<AppLang>(normalizeLang(shellui.language));

  private started = false;
  private offTheme: (() => void) | null = null;
  private offLanguage: (() => void) | null = null;

  /** Start handshake + theme/language sync (idempotent). */
  start(): void {
    if (this.started) return;
    this.started = true;

    const applyTheme = () => {
      shellui.applyTheme();
      this.theme.set(shellui.theme);
    };

    const applyLanguage = (code: string | null) => {
      this.language.set(normalizeLang(code));
    };

    void shellui.ready.then(() => {
      applyTheme();
      applyLanguage(shellui.language);
    });

    this.offTheme = shellui.on('theme', applyTheme);
    this.offLanguage = shellui.on('language', applyLanguage);
  }

  t(key: string): string {
    const lang = this.language();
    return messages[lang][key] ?? messages.en[key] ?? key;
  }

  themeLabel(): string {
    const current = this.theme();
    if (!current) return this.t('fallbackTheme');
    const name = (current.displayName as string) || (current.name as string) || 'shellui';
    return `${name} · ${current.mode}`;
  }
}
