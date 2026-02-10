import { useTranslation } from 'react-i18next';
import { useConfig } from '../features/config/useConfig';

export const HomeView = () => {
  const { t } = useTranslation('common');
  const { config } = useConfig();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 md:p-10 max-w-2xl mx-auto text-center">
      <h1
        className="m-0 text-3xl font-light text-foreground"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('welcome', { title: config?.title ?? 'ShellUI' })}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{t('getStarted')}</p>
      <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border text-left">
        <p className="text-sm font-medium text-foreground mb-2">
          {t('homeConfig.intro')}
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>{t('homeConfig.startUrl')}</li>
          <li>{t('homeConfig.rootNav')}</li>
        </ul>
      </div>
    </div>
  );
};
