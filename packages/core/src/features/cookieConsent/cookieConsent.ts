import type { ShellUIConfig } from '../config/types';

const STORAGE_KEY = 'shellui:settings';

function getConfig(): ShellUIConfig | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const g = globalThis as unknown as { __SHELLUI_CONFIG__?: string | ShellUIConfig };
  const raw = g.__SHELLUI_CONFIG__;
  if (raw === null || raw === undefined) return undefined;
  return typeof raw === 'string' ? (JSON.parse(raw) as ShellUIConfig) : raw;
}

function getStoredCookieConsent(): {
  acceptedHosts: string[];
  consentedCookieHosts: string[];
} {
  if (typeof window === 'undefined') {
    return { acceptedHosts: [], consentedCookieHosts: [] };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { acceptedHosts: [], consentedCookieHosts: [] };
    const parsed = JSON.parse(stored) as {
      cookieConsent?: { acceptedHosts?: string[]; consentedCookieHosts?: string[] };
    };
    return {
      acceptedHosts: Array.isArray(parsed?.cookieConsent?.acceptedHosts)
        ? parsed.cookieConsent.acceptedHosts
        : [],
      consentedCookieHosts: Array.isArray(parsed?.cookieConsent?.consentedCookieHosts)
        ? parsed.cookieConsent.consentedCookieHosts
        : [],
    };
  } catch {
    return { acceptedHosts: [], consentedCookieHosts: [] };
  }
}

/**
 * Returns whether the given cookie host is accepted by the user.
 * Use this outside React (e.g. in initSentry) to gate features by cookie consent.
 * - If there is no cookieConsent config, returns true (no consent required).
 * - If the host is not in the config list, returns true (unknown cookie, don't block).
 * - Otherwise returns whether the host is in settings.cookieConsent.acceptedHosts.
 */
export function getCookieConsentAccepted(host: string): boolean {
  const config = getConfig();
  if (!config?.cookieConsent?.cookies?.length) return true;
  const knownHosts = new Set(config.cookieConsent.cookies.map((c) => c.host));
  if (!knownHosts.has(host)) return true;
  const { acceptedHosts } = getStoredCookieConsent();
  return acceptedHosts.includes(host);
}

/**
 * Returns whether the app should ask for consent again because new cookies were added to config.
 * True when current config has at least one host that is not in consentedCookieHosts (the list
 * stored when the user last gave consent). When re-prompting, pre-fill with acceptedHosts so
 * existing approvals are kept.
 */
export function getCookieConsentNeedsRenewal(): boolean {
  const config = getConfig();
  if (!config?.cookieConsent?.cookies?.length) return false;
  const { consentedCookieHosts } = getStoredCookieConsent();
  if (consentedCookieHosts.length === 0) return true; // Never consented
  const currentHosts = new Set(config.cookieConsent.cookies.map((c) => c.host));
  for (const host of currentHosts) {
    if (!consentedCookieHosts.includes(host)) return true;
  }
  return false;
}

/**
 * Returns the list of cookie hosts that are in the current config but were not in the list
 * when the user last gave consent. Use to show "new" badges or to know which cookies need
 * fresh approval while keeping existing acceptedHosts as pre-checked.
 */
export function getCookieConsentNewHosts(): string[] {
  const config = getConfig();
  if (!config?.cookieConsent?.cookies?.length) return [];
  const { consentedCookieHosts } = getStoredCookieConsent();
  const consentedSet = new Set(consentedCookieHosts);
  return config.cookieConsent.cookies
    .map((c) => c.host)
    .filter((host) => !consentedSet.has(host));
}
