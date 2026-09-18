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
