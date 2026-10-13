import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';

/** Path identity-service returns to: `<scheme>://callback`. */
export const DESKTOP_AUTH_CALLBACK_HOST = 'callback';

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

/** Browser and network schemes identity-service refuses for desktop redirects. */
const REFUSED_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'data',
  'file',
  'vbscript',
  'about',
  'blob',
  'ftp',
  'mailto',
  'ws',
  'wss',
]);

const ERROR_MESSAGES: Record<string, string> = {
  pkce_required: 'Desktop sign-in needs a new attempt. Start sign-in again.',
  invalid_code_challenge_method:
    'Desktop sign-in used an unsupported verification method. Start sign-in again.',
  invalid_code_challenge: 'Desktop sign-in could not start verification. Start sign-in again.',
  invalid_code_verifier: 'Desktop sign-in could not verify this attempt. Start sign-in again.',
  pkce_verification_failed: 'Desktop sign-in could not verify this attempt. Start sign-in again.',
  unregistered_scheme: 'This desktop scheme is not registered on the OAuth application.',
  magic_link_expired: 'This email link has expired. Request a new one.',
  magic_link_invalid: 'This email link is not valid. Request a new one.',
  access_pending: 'Your account is waiting for an administrator to grant access.',
  access_denied: 'Your account cannot access this organization.',
  missing_auth_code: 'Desktop sign-in did not return a code. Start sign-in again.',
  desktop_signin_expired: 'Desktop sign-in expired. Start sign-in again.',
};

const OAUTH_ERROR_PARAM = 'shellui_oauth_error';
const OAUTH_ERROR_CODE_PARAM = 'shellui_oauth_error_code';

export function normalizeDesktopScheme(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const scheme = value.trim().toLowerCase();
  if (
    !scheme ||
    scheme !== value.trim() ||
    !SCHEME_PATTERN.test(scheme) ||
    REFUSED_SCHEMES.has(scheme)
  ) {
    return null;
  }
  return scheme;
}

export function desktopRedirectUri(scheme: string): string {
  return `${scheme}://${DESKTOP_AUTH_CALLBACK_HOST}`;
}

export function desktopAuthErrorMessage(errorCode: string, detail?: string | null): string {
  const known = ERROR_MESSAGES[errorCode];
  if (known) return known;
  if (detail && isSafeDisplayMessage(detail)) return detail;
  return 'Desktop sign-in failed. Start sign-in again.';
}

function isSafeDisplayMessage(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 180) return false;
  if (/bearer\s|eyJ|code_verifier|shellui_auth_code|verifier/i.test(text)) return false;
  return true;
}

export type DesktopAuthCallback =
  | { kind: 'code'; authCode: string; redirectTo: string }
  | { kind: 'error'; errorCode: string; message: string; redirectTo: string };

/**
 * Read a desktop deep link. Returns null when the scheme is not the one this
 * app registered. Does not include the verifier.
 */
export function parseDesktopAuthCallback(
  rawUrl: string,
  expectedScheme: string,
): DesktopAuthCallback | null {
  const scheme = normalizeDesktopScheme(expectedScheme);
  if (!scheme) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const callbackScheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (callbackScheme !== scheme) return null;

  const redirectTo = desktopRedirectUri(scheme);
  const errorCodeParam = (url.searchParams.get('error') || '').trim();
  const oauthError = (url.searchParams.get(OAUTH_ERROR_PARAM) || '').trim();
  const oauthErrorCode = (url.searchParams.get(OAUTH_ERROR_CODE_PARAM) || '').trim();

  if (errorCodeParam || oauthError || oauthErrorCode) {
    const errorCode = (oauthErrorCode || errorCodeParam || 'oauth_error').slice(0, 64);
    return {
      kind: 'error',
      errorCode,
      message: desktopAuthErrorMessage(errorCode, oauthError || null),
      redirectTo,
    };
  }

  const authCode = (url.searchParams.get(SHELLUI_AUTH_CODE_PARAM) || '').trim();
  if (!authCode) {
    return {
      kind: 'error',
      errorCode: 'missing_auth_code',
      message: desktopAuthErrorMessage('missing_auth_code'),
      redirectTo,
    };
  }

  return { kind: 'code', authCode, redirectTo };
}
