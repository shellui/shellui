import { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { useDialog } from '../alertDialog/DialogContext';
import { useConfig } from '../config/useConfig';
import { useSettings } from '../settings/hooks/useSettings';
import urls from '../../constants/urls';

/**
 * Shows a friendly cookie consent modal on first visit (when user has not yet consented).
 * Accept all / Reject all only. Closing via Escape or overlay counts as Reject.
 */
export function CookieConsentModal() {
  const { t } = useTranslation('cookieConsent');
  const { config } = useConfig();
  const { settings, updateSetting } = useSettings();
  const { dialog: showDialog } = useDialog();
  const closedByChoiceRef = useRef(false);
  const dialogShownRef = useRef(false);

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
  const shouldShow = isRootWindow && cookies.length > 0 && (neverConsented || hasNewCookies);

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

  const handleAccept = useCallback(() => {
    closedByChoiceRef.current = true;
    saveAccept();
  }, [saveAccept]);

  const handleReject = useCallback(() => {
    closedByChoiceRef.current = true;
    saveReject();
  }, [saveReject]);

  const handleSetPreferences = useCallback(() => {
    closedByChoiceRef.current = true;
    shellui.openDrawer({ url: `${urls.cookiePreferences}?initial=true`, size: '420px' });
  }, []);

  // Show/hide dialog based on shouldShow
  useEffect(() => {
    if (!shouldShow) {
      dialogShownRef.current = false;
      return;
    }

    // Prevent showing dialog multiple times
    if (dialogShownRef.current) {
      return;
    }

    // Mark as shown to prevent duplicate calls
    dialogShownRef.current = true;

    // Close any open modals/drawers when cookie consent is shown
    shellui.propagateMessage({ type: 'SHELLUI_CLOSE_MODAL', payload: {} });
    shellui.propagateMessage({ type: 'SHELLUI_CLOSE_DRAWER', payload: {} });

    // Reset choice ref when showing dialog
    closedByChoiceRef.current = false;

    // Show dialog using DialogContext directly (for root window)
    showDialog({
      title,
      description,
      mode: 'okCancel',
      okLabel: t('accept'),
      cancelLabel: t('reject'),
      position: 'bottom-left',
      icon: 'cookie',
      secondaryButton: {
        label: t('setPreferences'),
        onClick: handleSetPreferences,
      },
      onOk: handleAccept,
      onCancel: handleReject,
    });
  }, [
    shouldShow,
    title,
    description,
    t,
    handleAccept,
    handleReject,
    handleSetPreferences,
    showDialog,
  ]);

  return null;
}
