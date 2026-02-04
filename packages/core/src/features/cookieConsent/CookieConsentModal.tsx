import { useRef, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { shellui } from '@shellui/sdk';
import { Button } from '@/components/ui/button';
import { useConfig } from '../config/useConfig';
import { useSettings } from '../settings/hooks/useSettings';
import { Z_INDEX } from '@/lib/z-index';
import { CookiePreferencesDrawer } from './CookiePreferencesDrawer';

/**
 * Shows a friendly cookie consent modal on first visit (when user has not yet consented).
 * Accept all / Reject all only. Closing via Escape or overlay counts as Reject.
 */
export function CookieConsentModal() {
  const { t } = useTranslation('cookieConsent');
  const { config } = useConfig();
  const { settings, updateSetting } = useSettings();
  const closedByChoiceRef = useRef(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const cookieConsent = config?.cookieConsent;
  const cookies = cookieConsent?.cookies ?? [];
  const consentedHosts = settings?.cookieConsent?.consentedCookieHosts ?? [];
  const allHosts = cookies.map((c) => c.host);
  const strictNecessaryHosts = cookies
    .filter((c) => c.category === 'strict_necessary')
    .map((c) => c.host);

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
      acceptedHosts: strictNecessaryHosts,
      consentedCookieHosts: allHosts,
    });
  }, [strictNecessaryHosts, allHosts, updateSetting]);

  const handleAccept = () => {
    closedByChoiceRef.current = true;
    saveAccept();
  };

  const handleReject = () => {
    closedByChoiceRef.current = true;
    saveReject();
  };

  const handleSetPreferences = () => {
    closedByChoiceRef.current = true;
    setPreferencesOpen(true);
  };

  const handlePreferencesOpenChange = (nextOpen: boolean) => {
    setPreferencesOpen(nextOpen);
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

  // Hide modal when preferences drawer is open
  const showModal = open && !preferencesOpen;

  return (
    <>
      <DialogPrimitive.Root open={showModal} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-[1px]"
            style={{ zIndex: Z_INDEX.COOKIE_CONSENT_OVERLAY }}
          />
          <DialogPrimitive.Content
            className="fixed w-[calc(100%-32px)] max-w-[520px] rounded-xl border border-border bg-background text-foreground shadow-lg sm:w-full"
            style={{
              bottom: 16,
              left: 16,
              zIndex: Z_INDEX.COOKIE_CONSENT_CONTENT,
              backgroundColor: 'hsl(var(--background))',
            }}
            data-cookie-consent
          >
            <div className="flex items-start gap-4 p-6 sm:gap-5 sm:p-7">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                aria-hidden
              >
                <CookieIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <DialogPrimitive.Title className="text-base font-semibold leading-tight">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              </div>
            </div>
          <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/50 px-6 py-4 sm:px-7">
            <Button size="sm" variant="ghost" onClick={handleSetPreferences}>
              {t('setPreferences')}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleReject}>
                {t('reject')}
              </Button>
              <Button size="sm" onClick={handleAccept}>
                {t('accept')}
              </Button>
            </div>
          </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CookiePreferencesDrawer
        open={preferencesOpen}
        onOpenChange={handlePreferencesOpenChange}
        isInitialConsent
      />
    </>
  );
}

function CookieIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
    >
      <path d="M164.49 163.51a12 12 0 1 1-17 0a12 12 0 0 1 17 0m-81-8a12 12 0 1 0 17 0a12 12 0 0 0-16.98 0Zm9-39a12 12 0 1 0-17 0a12 12 0 0 0 17-.02Zm48-1a12 12 0 1 0 0 17a12 12 0 0 0 0-17M232 128A104 104 0 1 1 128 24a8 8 0 0 1 8 8a40 40 0 0 0 40 40a8 8 0 0 1 8 8a40 40 0 0 0 40 40a8 8 0 0 1 8 8m-16.31 7.39A56.13 56.13 0 0 1 168.5 87.5a56.13 56.13 0 0 1-47.89-47.19a88 88 0 1 0 95.08 95.08" />
    </svg>
  );
}
