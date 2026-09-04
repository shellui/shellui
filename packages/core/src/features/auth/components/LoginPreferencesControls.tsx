import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSupportedLanguages } from '../../../i18n/config';
import { cn } from '../../../lib/utils';
import { useConfig } from '../../config/useConfig';
import { useSettings } from '../../settings/hooks/useSettings';

const SunIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="4"
    />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const controlButtonClassName = cn(
  'inline-flex h-8 items-center justify-center rounded-md px-2',
  'text-xs font-medium tracking-wide text-muted-foreground/70',
  'transition-colors hover:bg-muted/60 hover:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
);

/**
 * Discreet language + color-scheme controls for the full-screen login page.
 * Hidden when login is embedded in a modal iframe.
 */
export const LoginPreferencesControls = () => {
  const { t } = useTranslation('settings');
  const { config } = useConfig();
  const { settings, updateSetting } = useSettings();
  const languages = useMemo(() => getSupportedLanguages(config?.language), [config?.language]);
  const currentLanguage = settings.language?.code || languages[0]?.code || 'en';
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const showLanguage = languages.length > 1;

  const cycleLanguage = () => {
    if (languages.length < 2) return;
    const index = languages.findIndex((lang) => lang.code === currentLanguage);
    const next = languages[(index + 1) % languages.length];
    if (next) {
      updateSetting('language', { code: next.code });
    }
  };

  const toggleColorScheme = () => {
    updateSetting('appearance', { colorScheme: isDark ? 'light' : 'dark' });
  };

  const currentLang = languages.find((lang) => lang.code === currentLanguage) ?? languages[0];
  const colorSchemeLabel = isDark ? t('appearance.themes.light') : t('appearance.themes.dark');

  return (
    <div className="flex items-center gap-0.5">
      {showLanguage && currentLang ? (
        <button
          type="button"
          className={controlButtonClassName}
          onClick={cycleLanguage}
          aria-label={currentLang.nativeName}
          title={currentLang.nativeName}
        >
          {currentLang.code.toUpperCase()}
        </button>
      ) : null}
      <button
        type="button"
        className={cn(controlButtonClassName, 'w-8 px-0')}
        onClick={toggleColorScheme}
        aria-label={colorSchemeLabel}
        title={colorSchemeLabel}
      >
        {isDark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
      </button>
    </div>
  );
};
