import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { shellui } from '@shellui/sdk';
import urls from '../../../../constants/urls';

/**
 * Settings → Develop: open the chrome-actions demo inside a modal/drawer iframe
 * so `shellui.actions.*` runs through the real postMessage path.
 */
export const ChromeActionsTestButtons = () => {
  const { t } = useTranslation('settings');

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
          onClick={() =>
            shellui.openModal({
              url: urls.chromeActionsDemo,
              size: 'lg',
            })
          }
        >
          {t('develop.testing.chromeActions.buttons.openModal')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            shellui.openDrawer({
              url: urls.chromeActionsDemo,
              position: 'bottom',
              size: '70vh',
            })
          }
        >
          {t('develop.testing.chromeActions.buttons.openDrawer')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            shellui.closeDrawer();
            shellui.closeModal();
          }}
        >
          {t('develop.testing.chromeActions.buttons.close')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t('develop.testing.chromeActions.description')}
      </p>
    </div>
  );
};
