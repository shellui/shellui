import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { requestUploadToastDemo } from '../../../storage/uploads/uploadQueue';

export const UploadToastTestButton = () => {
  const { t } = useTranslation('settings');

  return (
    <div>
      <h4
        className="text-sm font-medium mb-2"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('develop.testing.uploadProgress.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => requestUploadToastDemo()}
          variant="outline"
        >
          {t('develop.testing.uploadProgress.buttons.simulate')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t('develop.testing.uploadProgress.description')}
      </p>
    </div>
  );
};
