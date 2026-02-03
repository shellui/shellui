import { useTranslation } from 'react-i18next';
import { useConfig } from '../features/config/useConfig';

export const HomeView = () => {
  const { t } = useTranslation('common');
  const { config } = useConfig();
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 md:p-10">
      <h1
        className="m-0 text-3xl font-light text-foreground"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('welcome', { title: config.title })}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{t('getStarted')}</p>
    </div>
  );
};
