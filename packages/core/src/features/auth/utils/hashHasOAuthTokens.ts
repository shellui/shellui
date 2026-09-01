/**
 * True when the location hash looks like an identity fragment bounce
 * (`#access_token=…&refresh_token=…`).
 */
export function hashHasOAuthTokens(locationHash: string | null | undefined): boolean {
  if (!locationHash) return false;
  const params = new URLSearchParams(locationHash.replace(/^#/, ''));
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  return Boolean(access && refresh);
}
