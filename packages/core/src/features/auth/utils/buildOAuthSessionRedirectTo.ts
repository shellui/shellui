import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';

/**
 * Reconstruct the `redirect_to` URL for `POST /api/v1/oauth/session`.
 * Strips the one-time auth code while preserving other callback query params.
 */
export function buildOAuthSessionRedirectTo(
  origin: string,
  pathname: string,
  search: string,
): string {
  const url = new URL(`${origin}${pathname}`);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(SHELLUI_AUTH_CODE_PARAM);
  url.search = params.toString();
  return url.toString();
}

/**
 * Pick the `redirect_to` for the session exchange. Identity compares it exactly
 * with the value sent at sign-in start, so prefer that stored value. A static
 * host can add a trailing slash on the way back (GitHub Pages turns
 * `/login/callback` into `/login/callback/`). Fall back to the current URL when
 * nothing was stored or the stored value is for another origin.
 */
export function resolveOAuthSessionRedirectTo(
  storedRedirectTo: string | null | undefined,
  origin: string,
  pathname: string,
  search: string,
): string {
  if (storedRedirectTo) {
    try {
      if (new URL(storedRedirectTo).origin === origin) return storedRedirectTo;
    } catch {
      // invalid stored value: rebuild from the current URL
    }
  }
  return buildOAuthSessionRedirectTo(origin, pathname, search);
}
