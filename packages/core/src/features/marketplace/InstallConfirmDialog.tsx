import { useTranslation } from 'react-i18next';
import type { AppCapability } from '@shellui/sdk';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import type { InstallSummary } from './installApp';

const CAPABILITY_ORDER: AppCapability[] = [
  'theme',
  'locale',
  'ui',
  'navigate',
  'storage',
  'ai',
  'auth',
];

export function InstallConfirmDialog({
  summary,
  onConfirm,
  onCancel,
}: {
  summary: InstallSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const capabilities = (summary?.capabilities ?? [])
    .slice()
    .sort((a, b) => CAPABILITY_ORDER.indexOf(a) - CAPABILITY_ORDER.indexOf(b))
    .map((capability) => t(`marketplace.capability.${capability}`))
    .join(', ');

  return (
    <AlertDialog
      open={summary !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('marketplace.installTitle', { name: summary?.name ?? '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('marketplace.installBody', {
              name: summary?.name ?? '',
              origin: summary?.origin ?? '',
            })}{' '}
            {t('marketplace.capabilities', { list: capabilities })}
            {summary?.deniedPrivileged ? ` ${t('marketplace.hostOnly')}` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {t('marketplace.cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            onClick={onConfirm}
          >
            {t('marketplace.install')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
