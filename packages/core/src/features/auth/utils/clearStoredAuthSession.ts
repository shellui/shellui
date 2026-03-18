const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';

// Removes the persisted auth session from local storage.
export const clearStoredAuthSession = () => {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};
