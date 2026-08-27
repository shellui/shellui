import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { shellui } from '@shellui/sdk';
import urls from '../../../../constants/urls';

export const ModalTestButtons = () => {
  const { t } = useTranslation('settings');

  return (
    <div>
      <h4
        className="text-sm font-medium mb-2"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('develop.testing.modalTesting.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => shellui.openModal(urls.settings)}
          variant="outline"
        >
          {t('develop.testing.modalTesting.buttons.openModal')}
        </Button>
        <Button
          onClick={() => shellui.openModal({ url: urls.settings, size: 'sm' })}
          variant="outline"
        >
          {t('develop.testing.modalTesting.buttons.openModalSm')}
        </Button>
        <Button
          onClick={() =>
            shellui.openModal({ url: urls.settings, size: 'content', showCloseButton: false })
          }
          variant="outline"
        >
          {t('develop.testing.modalTesting.buttons.openModalContent')}
        </Button>
        <Button
          onClick={() => shellui.closeModal()}
          variant="outline"
        >
          {t('develop.testing.modalTesting.buttons.closeModal')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t('develop.testing.modalTesting.description')}
      </p>
    </div>
  );
};
