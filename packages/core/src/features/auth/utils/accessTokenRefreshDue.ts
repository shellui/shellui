/** Refresh the access token this many seconds before `expiresAt` so API calls stay valid. */
export const PROACTIVE_REFRESH_LEEWAY_SECONDS = 90;

/** True when the access token should be refreshed before it is handed to an iframe. */
export function accessTokenRefreshDue(expiresAt: number, nowSeconds: number): boolean {
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - nowSeconds <= PROACTIVE_REFRESH_LEEWAY_SECONDS;
}
