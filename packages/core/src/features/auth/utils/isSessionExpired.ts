import type { AuthSession } from '../types';

// Returns true when a session is already expired or about to expire.
export const isSessionExpired = (session: AuthSession) =>
  session.expiresAt <= Math.floor(Date.now() / 1000) + 30;
