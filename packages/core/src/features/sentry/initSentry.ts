import { getCookieConsentAccepted } from '../cookieConsent/cookieConsent';

const SETTINGS_KEY = 'shellui:settings';

/** True after @sentry/react has been lazy-loaded and init() was called. */
let sentryLoaded = false;

function isErrorReportingEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // If cookie consent is configured with a cookie for sentry.io, only enable when user accepted it
  if (!getCookieConsentAccepted('sentry.io')) return false;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return true;
    const parsed = JSON.parse(stored) as { errorReporting?: { enabled?: boolean } };
    return parsed?.errorReporting?.enabled !== false;
  } catch {
    return true;
  }
}

type SentryGlobals = {
  __SHELLUI_SENTRY_DSN__?: string;
  __SHELLUI_SENTRY_ENVIRONMENT__?: string;
  __SHELLUI_SENTRY_RELEASE__?: string;
};

/**
 * Initialize error reporting only in production when configured and user has not disabled it.
 * Lazy-loads @sentry/react only when needed so the bundle is not loaded when Sentry is unused.
 * Reads DSN, environment, and release from __SHELLUI_SENTRY_DSN__, __SHELLUI_SENTRY_ENVIRONMENT__,
 * and __SHELLUI_SENTRY_RELEASE__ (injected at build time) and user preference from settings.
 * Exported so the settings UI can re-initialize when the user re-enables reporting.
 */
export function initSentry(): void {
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  if (isDev) {
    return;
  }
  if (!isErrorReportingEnabled()) {
    return;
  }
  const g = globalThis as unknown as SentryGlobals;
  const dsn = g.__SHELLUI_SENTRY_DSN__;
  if (!dsn || typeof dsn !== 'string') {
    return;
  }
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: g.__SHELLUI_SENTRY_ENVIRONMENT__ ?? 'production',
      release: g.__SHELLUI_SENTRY_RELEASE__,
    });
    sentryLoaded = true;
  });
}

/**
 * Close Sentry when the user disables error reporting in settings.
 * Only loads @sentry/react if it was already initialized (avoids loading the chunk just to close).
 */
export function closeSentry(): void {
  if (!sentryLoaded) {
    return;
  }
  void import('@sentry/react').then((Sentry) => {
    Sentry.close();
    sentryLoaded = false;
  });
}

initSentry();
