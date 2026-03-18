import type { AuthSession } from '../types';

const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';

// Persists the current auth session to local storage for browser reload recovery.
export const persistAuthSession = (session: AuthSession) => {
  try {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors (e.g. private mode); user can still continue in-memory.
  }
};
