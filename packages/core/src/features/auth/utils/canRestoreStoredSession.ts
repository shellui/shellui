import type { AuthSession } from '../types';

/**
 * Whether a stored session snapshot can become a signed-in session on boot.
 *
 * The access token lives in memory only and the refresh token is tab-scoped
 * (sessionStorage), while the profile is shared in localStorage. A new tab
 * therefore sees the profile without any token. Without a token, or a refresh
 * token or BFF cookie to get one, the snapshot must not count as signed in.
 */
export const canRestoreStoredSession = (stored: AuthSession, bffAuthEnabled: boolean): boolean =>
  Boolean(stored.accessToken || stored.refreshToken || bffAuthEnabled);
