import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useModal } from '../../modal/ModalContext';
import { useDrawer } from '../../drawer/DrawerContext';
import { useStoragePicker } from '../../storage/StoragePickerContext';
import { goDesktopBack, type DesktopBackIframe } from './goDesktopBack';

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function DesktopBackButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isOpen: modalOpen, closeModal } = useModal();
  const { isOpen: drawerOpen, closeDrawer } = useDrawer();
  const { isOpen: pickerOpen, closePicker } = useStoragePicker();

  const handleBack = useCallback(() => {
    const iframes = shellui.frameRegistry.getAllIframes().map(([, iframe]) => iframe);
    goDesktopBack({
      iframes: iframes as DesktopBackIframe[],
      overlaysOpen: modalOpen || drawerOpen || pickerOpen,
      closeOverlays: () => {
        if (pickerOpen) closePicker();
        if (modalOpen) closeModal();
        if (drawerOpen) closeDrawer();
      },
      goRouterBack: () => navigate(-1),
      baseHref: window.location.href,
    });
  }, [closeDrawer, closeModal, closePicker, drawerOpen, modalOpen, navigate, pickerOpen]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('desktopChrome.back')}
      data-shellui-no-drag=""
      className={cn(
        'size-8 shrink-0 touch-manipulation select-none [-webkit-touch-callout:none]',
        className,
      )}
      onClick={handleBack}
    >
      <BackIcon />
    </Button>
  );
}
