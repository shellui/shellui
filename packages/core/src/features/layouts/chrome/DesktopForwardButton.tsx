import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { goDesktopForward, type DesktopBackIframe } from './goDesktopBack';

function ForwardIcon({ className }: { className?: string }) {
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
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function DesktopForwardButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleForward = useCallback(() => {
    const iframes = shellui.frameRegistry.getAllIframes().map(([, iframe]) => iframe);
    goDesktopForward({
      iframes: iframes as DesktopBackIframe[],
      goRouterForward: () => navigate(1),
      baseHref: window.location.href,
    });
  }, [navigate]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('desktopChrome.forward')}
      data-shellui-no-drag=""
      className={cn(
        'size-7 shrink-0 touch-manipulation select-none text-muted-foreground [-webkit-touch-callout:none]',
        'hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        className,
      )}
      onClick={handleForward}
    >
      <ForwardIcon />
    </Button>
  );
}
