import { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { shellui } from '@shellui/sdk';
import { Button } from '@/components/ui/button';
import { useConfig } from '../config/useConfig';
import { useSettings } from '../settings/hooks/useSettings';
import { Z_INDEX } from '@/lib/z-index';

/**
 * Shows a friendly cookie consent modal on first visit (when user has not yet consented).
 * Accept all / Reject all only. Closing via Escape or overlay counts as Reject.
 */
export function CookieConsentModal() {
  const { t } = useTranslation('cookieConsent');
  const { config } = useConfig();
  const { settings, updateSetting } = useSettings();
  const closedByChoiceRef = useRef(false);

  const cookieConsent = config?.cookieConsent;
  const cookies = cookieConsent?.cookies ?? [];
  const consentedHosts = settings?.cookieConsent?.consentedCookieHosts ?? [];
  const allHosts = cookies.map((c) => c.host);

  // Check if there are new cookies that weren't in the list when user last consented
  const hasNewCookies = allHosts.some((host) => !consentedHosts.includes(host));
  const neverConsented = consentedHosts.length === 0;
  const isRenewal = !neverConsented && hasNewCookies;

  // Only show in root window, not in sub-apps (iframes)
  const isRootWindow = typeof window !== 'undefined' && window.parent === window;
  // Show if: has cookies AND (never consented OR new cookies added)
  const open = isRootWindow && cookies.length > 0 && (neverConsented || hasNewCookies);

  // Use renewal text if showing due to cookie policy update
  const title = isRenewal ? t('titleRenewal') : t('title');
  const description = isRenewal ? t('descriptionRenewal') : t('description');

  const saveAccept = useCallback(() => {
    updateSetting('cookieConsent', {
      acceptedHosts: allHosts,
      consentedCookieHosts: allHosts,
    });
  }, [allHosts, updateSetting]);

  const saveReject = useCallback(() => {
    updateSetting('cookieConsent', {
      acceptedHosts: [],
      consentedCookieHosts: allHosts,
    });
  }, [allHosts, updateSetting]);

  const handleAccept = () => {
    closedByChoiceRef.current = true;
    saveAccept();
  };

  const handleReject = () => {
    closedByChoiceRef.current = true;
    saveReject();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (!closedByChoiceRef.current) {
        saveReject();
      }
      closedByChoiceRef.current = false;
    }
  };

  // Close any open modals/drawers when cookie consent is shown
  useEffect(() => {
    if (open) {
      shellui.propagateMessage({ type: 'SHELLUI_CLOSE_MODAL', payload: {} });
      shellui.propagateMessage({ type: 'SHELLUI_CLOSE_DRAWER', payload: {} });
    }
  }, [open]);

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-[1px]"
          style={{ zIndex: Z_INDEX.COOKIE_CONSENT_OVERLAY }}
        />
        <DialogPrimitive.Content
          className="fixed w-full max-w-[380px] rounded-lg border border-border bg-background text-foreground shadow-lg"
          style={{
            bottom: 16,
            left: 16,
            zIndex: Z_INDEX.COOKIE_CONSENT_CONTENT,
            backgroundColor: 'hsl(var(--background))',
          }}
          data-cookie-consent
        >
          <div className="flex items-start gap-3 p-4">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
              aria-hidden
            >
              <CookieIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <DialogPrimitive.Title className="text-sm font-semibold leading-tight">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            </div>
          </div>
          <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-muted/50 px-4 py-3">
            <Button size="sm" variant="ghost" onClick={handleReject}>
              {t('reject')}
            </Button>
            <Button size="sm" onClick={handleAccept}>
              {t('accept')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CookieIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Cookie outline */}
      <circle cx="12" cy="12" r="10" />
      {/* Chocolate chips */}
      <circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
