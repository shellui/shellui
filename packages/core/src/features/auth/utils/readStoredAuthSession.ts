import type { AuthSession } from '../types';

const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';

// Reads a previously persisted auth session from local storage.
export const readStoredAuthSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};
