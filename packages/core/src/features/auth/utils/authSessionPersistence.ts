import type { AuthSession } from '../types';
import {
  AUTH_PROFILE_STORAGE_KEY,
  AUTH_REFRESH_STORAGE_KEY,
  LEGACY_AUTH_SESSION_STORAGE_KEY,
} from './authStorageKeys';

/** Fields stored in localStorage for reload UX (no secrets). */
export type PersistedAuthProfile = Omit<
  AuthSession,
  'accessToken' | 'refreshToken' | 'tokenType'
> & {
  tokenType?: string;
};

const profileFromSession = (session: AuthSession): PersistedAuthProfile => {
  const { accessToken: _a, refreshToken: _r, ...profile } = session;
  return profile;
};

const readRefreshFromSessionStorage = (): string | null => {
  try {
    return sessionStorage.getItem(AUTH_REFRESH_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeRefreshToSessionStorage = (refreshToken: string | null | undefined) => {
  try {
    if (refreshToken) {
      sessionStorage.setItem(AUTH_REFRESH_STORAGE_KEY, refreshToken);
    } else {
      sessionStorage.removeItem(AUTH_REFRESH_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / private mode.
  }
};

const readLegacyMonolithicSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

const clearLegacyMonolithicSession = () => {
  try {
    localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore.
  }
};

const readProfile = (): PersistedAuthProfile | null => {
  try {
    const raw = localStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAuthProfile;
  } catch {
    return null;
  }
};

const writeProfile = (profile: PersistedAuthProfile | null) => {
  try {
    if (profile) {
      localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY);
    }
  } catch {
    // Ignore.
  }
};

const mergeProfileAndTokens = (
  profile: PersistedAuthProfile,
  accessToken: string,
  refreshToken: string,
): AuthSession => ({
  ...profile,
  accessToken,
  refreshToken,
  tokenType: profile.tokenType ?? 'bearer',
});

/**
 * Persist auth state with minimized blast radius:
 * - Profile metadata in localStorage (no tokens)
 * - Refresh token in sessionStorage (tab-scoped; omitted when `storeRefreshToken` is false for BFF)
 * - Access token is never written to web storage (memory only)
 */
export const persistAuthSession = (
  session: AuthSession,
  options?: { storeRefreshToken?: boolean },
) => {
  const storeRefresh = options?.storeRefreshToken !== false;
  writeProfile(profileFromSession(session));
  if (storeRefresh) {
    writeRefreshToSessionStorage(session.refreshToken);
  } else {
    writeRefreshToSessionStorage(null);
  }
  clearLegacyMonolithicSession();
};

/** Read rehydratable session snapshot (access token empty until refresh). */
export const readStoredAuthSession = (): AuthSession | null => {
  const legacy = readLegacyMonolithicSession();
  if (legacy) {
    persistAuthSession(legacy);
    return legacy;
  }

  const profile = readProfile();
  if (!profile) return null;

  const refreshToken = readRefreshFromSessionStorage() ?? '';
  return mergeProfileAndTokens(profile, '', refreshToken);
};

/** Remove all persisted auth keys (profile, refresh, legacy). */
export const clearStoredAuthSession = () => {
  writeProfile(null);
  writeRefreshToSessionStorage(null);
  clearLegacyMonolithicSession();
};

/** Update profile metadata without touching refresh storage. */
export const persistAuthProfile = (session: AuthSession) => {
  writeProfile(profileFromSession(session));
  clearLegacyMonolithicSession();
};
