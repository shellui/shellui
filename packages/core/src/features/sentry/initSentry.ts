import * as Sentry from '@sentry/react';

const SETTINGS_KEY = 'shellui:settings';

function isErrorReportingEnabled(): boolean {
  if (typeof window === 'undefined') return true;
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
  Sentry.init({
    dsn,
    environment: g.__SHELLUI_SENTRY_ENVIRONMENT__ ?? 'production',
    release: g.__SHELLUI_SENTRY_RELEASE__,
  });
}

initSentry();
