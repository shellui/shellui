import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { shellui } from '@shellui/sdk';

/**
 * Settings → Develop harness for floating chrome actions.
 * Calls `shellui.actions.set/clear` from the shell window (synthetic frame).
 */
export const ChromeActionsTestButtons = () => {
  const { t } = useTranslation('settings');

  const setDemo = (variant: 'default' | 'updated' = 'default') => {
    const updated = variant === 'updated';
    shellui.actions.set({
      back: {
        id: 'dev-back',
        onClick: () => {
          shellui.toast({
            title: t('develop.testing.chromeActions.toasts.back'),
            type: 'info',
          });
        },
      },
      title: updated
        ? t('develop.testing.chromeActions.titles.updated')
        : t('develop.testing.chromeActions.titles.default'),
      trailing: [
        {
          id: 'dev-edit',
          label: updated
            ? t('develop.testing.chromeActions.trailing.rename')
            : t('develop.testing.chromeActions.trailing.edit'),
          onClick: () => {
            shellui.toast({
              title: t('develop.testing.chromeActions.toasts.edit'),
              type: 'default',
            });
          },
        },
        {
          id: 'dev-share',
          label: t('develop.testing.chromeActions.trailing.share'),
          onClick: () => {
            shellui.toast({
              title: t('develop.testing.chromeActions.toasts.share'),
              type: 'default',
            });
          },
        },
        {
          id: 'dev-filter',
          label: t('develop.testing.chromeActions.trailing.filter'),
          onClick: () => {
            shellui.toast({
              title: t('develop.testing.chromeActions.toasts.filter'),
              type: 'default',
            });
          },
        },
        {
          id: 'dev-archive',
          label: t('develop.testing.chromeActions.trailing.archive'),
          onClick: () => {
            shellui.toast({
              title: t('develop.testing.chromeActions.toasts.archive'),
              type: 'default',
            });
          },
        },
      ],
      primary: {
        id: 'dev-compose',
        icon: 'plus',
        label: t('develop.testing.chromeActions.primary'),
        onClick: () => {
          shellui.toast({
            title: t('develop.testing.chromeActions.toasts.primary'),
            type: 'success',
          });
        },
      },
    });
  };

  return (
    <div>
      <h4
        className="text-sm font-medium mb-2"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('develop.testing.chromeActions.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDemo('default')}
        >
          {t('develop.testing.chromeActions.buttons.set')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDemo('updated')}
        >
          {t('develop.testing.chromeActions.buttons.update')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => shellui.actions.clear()}
        >
          {t('develop.testing.chromeActions.buttons.clear')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t('develop.testing.chromeActions.description')}
      </p>
    </div>
  );
};
