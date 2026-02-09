import { shellui } from 'node_modules/@shellui/sdk/src';
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
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]');

    // For localhost, use tunnel through the dev server to avoid CORS issues
    // The tunnel endpoint proxies requests to Sentry, bypassing browser CORS restrictions
    const tunnel =
      isLocalhost && typeof window !== 'undefined'
        ? `${window.location.origin}/api/sentry-tunnel`
        : undefined;

    Sentry.init({
      dsn,
      environment: g.__SHELLUI_SENTRY_ENVIRONMENT__ ?? 'production',
      release: g.__SHELLUI_SENTRY_RELEASE__,
      sendDefaultPii: true,
      // Use tunnel for localhost to avoid CORS issues
      ...(tunnel && { tunnel }),
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

/**
 * Ensure Sentry is initialized and ready, then capture an exception.
 * Useful for manually triggering error reports (e.g., test button).
 * This function will initialize Sentry even in dev mode if needed for testing.
 * @param error - The error to capture
 * @returns Promise that resolves when the error has been sent (or rejected if Sentry is unavailable)
 */
export async function captureException(error: Error): Promise<void> {
  const g = globalThis as unknown as SentryGlobals;
  const dsn = g.__SHELLUI_SENTRY_DSN__;

  if (!dsn || typeof dsn !== 'string') {
    throw new Error('Sentry DSN not configured');
  }

  // If Sentry is not loaded, initialize it (even in dev mode for testing)
  if (!sentryLoaded) {
    // Check if error reporting is enabled
    if (!isErrorReportingEnabled()) {
      throw new Error('Error reporting is disabled in settings');
    }

    // Import and initialize Sentry (bypass dev mode check for manual testing)
    const Sentry = await import('@sentry/react');
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]');

    // For localhost, use tunnel through the dev server to avoid CORS issues
    // The tunnel endpoint proxies requests to Sentry, bypassing browser CORS restrictions
    const tunnel =
      isLocalhost && typeof window !== 'undefined'
        ? `${window.location.origin}/api/sentry-tunnel`
        : undefined;

    Sentry.init({
      dsn,
      environment: g.__SHELLUI_SENTRY_ENVIRONMENT__ ?? 'production',
      release: g.__SHELLUI_SENTRY_RELEASE__,
      sendDefaultPii: true,
      // Use tunnel for localhost to avoid CORS issues
      ...(tunnel && { tunnel }),
    });
    sentryLoaded = true;

    // Wait a bit for Sentry to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Capture the exception
  const Sentry = await import('@sentry/react');
  if (Sentry.captureException) {
    Sentry.captureException(error);
  } else {
    throw new Error('Sentry captureException not available');
  }
}

initSentry();
