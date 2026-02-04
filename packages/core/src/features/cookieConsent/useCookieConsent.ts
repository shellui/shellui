import { useMemo } from 'react';
import { useConfig } from '../config/useConfig';
import { useSettings } from '../settings/hooks/useSettings';
import { getCookieConsentNeedsRenewal } from './cookieConsent';

/**
 * Returns whether the given cookie host is accepted (feature may run) and whether
 * consent should be re-collected. Use to gate features in React components.
 *
 * - isAccepted: true if cookie consent is not configured, or the host is not in the config list,
 *   or the user has accepted this host.
 * - needsConsent: true if cookie consent is configured and the user has not yet consented,
 *   or new cookies were added since last consent (renewal); when showing the UI again, pre-fill
 *   with settings.cookieConsent.acceptedHosts to keep existing approvals.
 */
export function useCookieConsent(host: string): { isAccepted: boolean; needsConsent: boolean } {
  const { config } = useConfig();
  const { settings } = useSettings();

  return useMemo(() => {
    const cookieConsent = config?.cookieConsent;
    const list = cookieConsent?.cookies ?? [];
    const acceptedHosts = settings?.cookieConsent?.acceptedHosts ?? [];

    if (!list.length) {
      return { isAccepted: true, needsConsent: false };
    }

    const knownHosts = new Set(list.map((c) => c.host));
    if (!knownHosts.has(host)) {
      return { isAccepted: true, needsConsent: false };
    }

    const isAccepted = acceptedHosts.includes(host);
    const needsConsent = acceptedHosts.length === 0 || getCookieConsentNeedsRenewal();

    return { isAccepted, needsConsent };
  }, [config?.cookieConsent, settings?.cookieConsent?.acceptedHosts, host]);
}
