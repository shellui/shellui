import type { AuthSession } from '../types';
import { isSessionExpired } from './isSessionExpired';

/**
 * Whether a stored session snapshot can become a signed-in session on boot.
 *
 * The access token lives in memory only and the refresh token is tab-scoped
 * (sessionStorage), while the profile is shared in localStorage. A new tab
 * therefore sees the profile without any token. Without a token, or a refresh
 * token or BFF cookie to get one, the snapshot must not count as signed in.
 * A false result means the profile is stale: the caller clears it and shows login.
 */
export const canRestoreStoredSession = (stored: AuthSession, bffAuthEnabled: boolean): boolean =>
  Boolean(stored.accessToken || stored.refreshToken || bffAuthEnabled);

/** Refresh failed because the cookie or refresh token was missing or rejected. */
export const isUnauthorizedRefreshError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : '';
  return /\b401\b/.test(message);
};

export type StoredSessionBootPlan =
  | { action: 'clear' }
  | { action: 'use'; session: AuthSession }
  | { action: 'refresh'; session: AuthSession };

/**
 * What boot should do with a stored profile.
 *
 * `clear` — nothing can restore it (no refresh token and BFF is off, or the
 * access token is expired and there is still nothing to refresh with). The
 * caller deletes the profile so login is a normal signed-out page.
 * `refresh` — a refresh token or the BFF cookie may mint a new access token.
 * `use` — the access token is still valid, or auto-refresh is disabled on purpose.
 */
export const planStoredSessionBoot = (
  stored: AuthSession,
  bffAuthEnabled: boolean,
  options?: { autoRefreshDisabled?: boolean },
): StoredSessionBootPlan => {
  if (!canRestoreStoredSession(stored, bffAuthEnabled)) {
    return { action: 'clear' };
  }

  const needsToken = !stored.accessToken || isSessionExpired(stored);
  if (!needsToken) {
    return { action: 'use', session: stored };
  }

  if (options?.autoRefreshDisabled) {
    return { action: 'use', session: stored };
  }

  if (stored.refreshToken || bffAuthEnabled) {
    return { action: 'refresh', session: stored };
  }

  return { action: 'clear' };
};
