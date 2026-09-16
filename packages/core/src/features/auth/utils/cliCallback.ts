import type { AuthSession } from '../types';

/** Query param on `/login` used by `shellui login`. */
export const CLI_CALLBACK_PARAM = 'shellui_cli_callback';

const CLI_CALLBACK_STORAGE_KEY = 'shellui.cli_callback';

/**
 * True when the URL is an http(s) loopback address (CLI OAuth bounce target).
 */
export function isLoopbackCliCallbackUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * Persist a loopback CLI callback from the current location search (survives OAuth round-trip).
 */
export function captureCliCallbackFromSearch(search: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
    CLI_CALLBACK_PARAM,
  );
  if (!raw || !isLoopbackCliCallbackUrl(raw)) return;
  try {
    sessionStorage.setItem(CLI_CALLBACK_STORAGE_KEY, raw);
  } catch {
    // ignore quota / private mode
  }
}

function readStoredCliCallback(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CLI_CALLBACK_STORAGE_KEY);
    if (!raw || !isLoopbackCliCallbackUrl(raw)) {
      sessionStorage.removeItem(CLI_CALLBACK_STORAGE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function clearStoredCliCallback(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(CLI_CALLBACK_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * If a CLI loopback callback is pending, redirect there with tokens in the fragment.
 * @returns true when navigation was started
 */
export function redirectToCliCallback(
  session: Pick<AuthSession, 'accessToken' | 'refreshToken' | 'tokenType' | 'expiresAt'>,
): boolean {
  const callback = readStoredCliCallback();
  if (!callback) return false;
  clearStoredCliCallback();
  const params = new URLSearchParams();
  params.set('access_token', session.accessToken);
  params.set('refresh_token', session.refreshToken);
  params.set('token_type', session.tokenType || 'bearer');
  if (Number.isFinite(session.expiresAt)) {
    params.set('expires_at', String(session.expiresAt));
  }
  const href = `${callback}#${params.toString()}`;
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign(href);
  } else if (typeof location !== 'undefined' && typeof location.assign === 'function') {
    location.assign(href);
  } else {
    return false;
  }
  return true;
}

/**
 * If a CLI loopback callback is pending, redirect there with an OAuth error in the query.
 * @returns true when navigation was started
 */
export function redirectCliCallbackError(message: string, errorCode?: string | null): boolean {
  const callback = readStoredCliCallback();
  if (!callback) return false;
  clearStoredCliCallback();
  try {
    const url = new URL(callback);
    url.searchParams.set(
      'shellui_oauth_error',
      (message || 'OAuth sign-in failed.').replace(/\r|\n/g, ' ').trim().slice(0, 500),
    );
    if (errorCode && errorCode.trim()) {
      url.searchParams.set('shellui_oauth_error_code', errorCode.trim().slice(0, 64));
    }
    const href = url.toString();
    if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
      window.location.assign(href);
    } else if (typeof location !== 'undefined' && typeof location.assign === 'function') {
      location.assign(href);
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
