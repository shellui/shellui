import { useTranslation } from 'react-i18next';

/** Full-area spinner shown while the first session restore resolves (e.g. after a reload). */
export const SessionLoadingView = () => {
  const { t } = useTranslation('common');

  return (
    <div
      role="status"
      aria-live="polite"
      data-shellui-session-loading=""
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-6"
    >
      <div
        className="size-6 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{t('sessionLoading')}</p>
    </div>
  );
};
