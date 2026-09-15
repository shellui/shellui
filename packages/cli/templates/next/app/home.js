'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { normalizeLang, t } from './i18n';

function themeLabel(theme, lang) {
  if (!theme) return t(lang, 'fallbackTheme');
  const name = theme.displayName || theme.name || 'shellui';
  return `${name} · ${theme.mode}`;
}

/**
 * Client home: theme + language sync via @shellui/sdk/tiny.
 * Dynamic import keeps SSR from evaluating `location` in the tiny SDK.
 */
export default function ShelluiHome() {
  const [theme, setTheme] = useState(null);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    let cancelled = false;
    let offTheme = () => {};
    let offLanguage = () => {};

    void import('@shellui/sdk/tiny').then(({ shellui }) => {
      if (cancelled) return;

      const applyTheme = () => {
        shellui.applyTheme();
        setTheme(shellui.theme);
      };

      const applyLanguage = (code) => {
        setLanguage(normalizeLang(code));
      };

      void shellui.ready.then(() => {
        if (cancelled) return;
        applyTheme();
        applyLanguage(shellui.language);
      });

      offTheme = shellui.on('theme', applyTheme);
      offLanguage = shellui.on('language', applyLanguage);
    });

    return () => {
      cancelled = true;
      offTheme();
      offLanguage();
    };
  }, []);

  return (
    <main className={styles.home}>
      <p className={styles.eyebrow}>Shellui</p>
      <h1>{t(language, 'title')}</h1>
      <p className={styles.blurb}>{t(language, 'blurb')}</p>

      <dl className={styles.meta}>
        <div>
          <dt>{t(language, 'themeLabel')}</dt>
          <dd>{themeLabel(theme, language)}</dd>
        </div>
        <div>
          <dt>{t(language, 'languageLabel')}</dt>
          <dd>{language || t(language, 'fallbackLanguage')}</dd>
        </div>
      </dl>

      <p className={styles.hint}>{t(language, 'hint')}</p>
    </main>
  );
}
