const SETTINGS_STORAGE_KEY = 'shellui:settings';

/**
 * Reads the Develop-panel flag that skips background (and restore) token refresh
 * so expired access tokens can be exercised locally.
 */
export const isTokenAutoRefreshDisabled = (): boolean => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as {
      developerFeatures?: { disableTokenAutoRefresh?: boolean };
    };
    return parsed.developerFeatures?.disableTokenAutoRefresh === true;
  } catch {
    return false;
  }
};
