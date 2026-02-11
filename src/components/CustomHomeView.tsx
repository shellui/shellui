import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../packages/core/src/features/config/useConfig';

export const CustomHomeView = () => {
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
    </div>
  );
};
