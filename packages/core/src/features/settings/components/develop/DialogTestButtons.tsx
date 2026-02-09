import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { shellui } from '@shellui/sdk';

export const DialogTestButtons = () => {
  const { t } = useTranslation('settings');

  return (
    <div>
      <h4
        className="text-sm font-medium mb-2"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('develop.testing.dialogTesting.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            shellui.dialog({
              title: t('develop.testing.dialogTesting.dialogs.ok.title'),
              description: t('develop.testing.dialogTesting.dialogs.ok.description'),
              mode: 'ok',
              onOk: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.okClicked'),
                  type: 'success',
                });
              },
            });
          }}
          variant="outline"
        >
          {t('develop.testing.dialogTesting.buttons.okDialog')}
        </Button>
        <Button
          onClick={() => {
            shellui.dialog({
              title: t('develop.testing.dialogTesting.dialogs.okCancel.title'),
              description: t('develop.testing.dialogTesting.dialogs.okCancel.description'),
              mode: 'okCancel',
              size: 'sm',
              onOk: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.okClicked'),
                  type: 'success',
                });
              },
              onCancel: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.cancelClicked'),
                  type: 'info',
                });
              },
            });
          }}
          variant="outline"
        >
          {t('develop.testing.dialogTesting.buttons.okCancelDialog')}
        </Button>
        <Button
          onClick={() => {
            shellui.dialog({
              title: t('develop.testing.dialogTesting.dialogs.delete.title'),
              description: t('develop.testing.dialogTesting.dialogs.delete.description'),
              mode: 'delete',
              okLabel: t('develop.testing.dialogTesting.dialogs.delete.okLabel'),
              cancelLabel: t('develop.testing.dialogTesting.dialogs.delete.cancelLabel'),
              size: 'sm',
              onOk: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.itemDeleted'),
                  type: 'success',
                });
              },
              onCancel: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.deletionCancelled'),
                  type: 'info',
                });
              },
            });
          }}
          variant="outline"
        >
          {t('develop.testing.dialogTesting.buttons.deleteDialog')}
        </Button>
        <Button
          onClick={() => {
            shellui.dialog({
              title: t('develop.testing.dialogTesting.dialogs.confirm.title'),
              description: t('develop.testing.dialogTesting.dialogs.confirm.description'),
              mode: 'confirm',
              okLabel: t('develop.testing.dialogTesting.dialogs.confirm.okLabel'),
              cancelLabel: t('develop.testing.dialogTesting.dialogs.confirm.cancelLabel'),
              size: 'sm',
              onOk: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.actionConfirmed'),
                  type: 'success',
                });
              },
              onCancel: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.actionCancelled'),
                  type: 'info',
                });
              },
            });
          }}
          variant="outline"
        >
          {t('develop.testing.dialogTesting.buttons.confirmDialog')}
        </Button>
        <Button
          onClick={() => {
            shellui.dialog({
              title: t('develop.testing.dialogTesting.dialogs.onlyCancel.title'),
              description: t('develop.testing.dialogTesting.dialogs.onlyCancel.description'),
              mode: 'onlyCancel',
              cancelLabel: t('develop.testing.dialogTesting.dialogs.onlyCancel.cancelLabel'),
              size: 'sm',
              onCancel: () => {
                shellui.toast({
                  title: t('develop.testing.dialogTesting.toasts.dialogClosed'),
                  type: 'info',
                });
              },
            });
          }}
          variant="outline"
        >
          {t('develop.testing.dialogTesting.buttons.onlyCancelDialog')}
        </Button>
      </div>
    </div>
  );
};
