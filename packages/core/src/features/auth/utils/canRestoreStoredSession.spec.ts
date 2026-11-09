import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../types';
import { AUTH_PROFILE_STORAGE_KEY, AUTH_REFRESH_STORAGE_KEY } from './authStorageKeys';
import {
  clearStoredAuthSession,
  hasStoredAuthSession,
  persistAuthSession,
  readStoredAuthSession,
} from './authSessionPersistence';
import {
  canRestoreStoredSession,
  isUnauthorizedRefreshError,
  planStoredSessionBoot,
} from './canRestoreStoredSession';

const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 120;

const base = {
  accessToken: '',
  refreshToken: '',
  tokenType: 'bearer',
  expiresAt: future,
  provider: 'github',
  userId: 'user-1',
  userEmail: 'a@example.com',
  userName: 'Ada',
  userAvatarUrl: null,
  userIsStaff: false,
  userIsCompanyOwner: false,
  userGroups: [],
} as AuthSession;

const createStorageMock = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => data.set(key, value)),
    removeItem: vi.fn((key: string) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  } as unknown as Storage;
};

describe('canRestoreStoredSession', () => {
  it('rejects a profile without tokens, as seen in a new tab', () => {
    expect(canRestoreStoredSession(base, false)).toBe(false);
  });

  it('accepts a refresh token', () => {
    expect(canRestoreStoredSession({ ...base, refreshToken: 'r' }, false)).toBe(true);
  });

  it('accepts an access token', () => {
    expect(canRestoreStoredSession({ ...base, accessToken: 'a' }, false)).toBe(true);
  });

  it('accepts a token-less profile when BFF cookies can refresh it', () => {
    expect(canRestoreStoredSession(base, true)).toBe(true);
  });
});

describe('planStoredSessionBoot', () => {
  it('clears a profile that has no refresh token when BFF is off', () => {
    expect(planStoredSessionBoot(base, false)).toEqual({ action: 'clear' });
  });

  it('refreshes a token-less profile through the BFF cookie', () => {
    expect(planStoredSessionBoot(base, true)).toEqual({ action: 'refresh', session: base });
  });

  it('refreshes when a refresh token is present', () => {
    const stored = { ...base, refreshToken: 'r' };
    expect(planStoredSessionBoot(stored, false)).toEqual({ action: 'refresh', session: stored });
  });

  it('uses a still-valid access token', () => {
    const stored = { ...base, accessToken: 'a' };
    expect(planStoredSessionBoot(stored, false)).toEqual({ action: 'use', session: stored });
  });

  it('refreshes an expired access token when a refresh token exists', () => {
    const stored = { ...base, accessToken: 'a', refreshToken: 'r', expiresAt: past };
    expect(planStoredSessionBoot(stored, false)).toEqual({ action: 'refresh', session: stored });
  });

  it('clears an expired access token when nothing can refresh it', () => {
    const stored = { ...base, accessToken: 'a', expiresAt: past };
    expect(planStoredSessionBoot(stored, false)).toEqual({ action: 'clear' });
  });

  it('keeps an expired session when auto-refresh is disabled', () => {
    const stored = { ...base, accessToken: 'a', expiresAt: past };
    expect(planStoredSessionBoot(stored, false, { autoRefreshDisabled: true })).toEqual({
      action: 'use',
      session: stored,
    });
  });
});

describe('isUnauthorizedRefreshError', () => {
  it('matches a BFF or identity 401', () => {
    expect(isUnauthorizedRefreshError(new Error('HTTP 401'))).toBe(true);
    expect(isUnauthorizedRefreshError(new Error('BFF session failed (HTTP 401)'))).toBe(true);
  });

  it('does not treat other failures as a rejected credential', () => {
    expect(isUnauthorizedRefreshError(new Error('HTTP 500'))).toBe(false);
    expect(isUnauthorizedRefreshError(new Error('HTTP 4010'))).toBe(false);
    expect(isUnauthorizedRefreshError('HTTP 401')).toBe(false);
  });
});

describe('stale profile is removed when it cannot be restored', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: createStorageMock(),
    });
  });

  it('drops the shared profile after the tab-scoped refresh token is gone', () => {
    persistAuthSession({ ...base, accessToken: 'access', refreshToken: 'refresh' });
    sessionStorage.removeItem(AUTH_REFRESH_STORAGE_KEY);

    const stored = readStoredAuthSession();
    if (!stored) {
      throw new Error('expected a stored profile');
    }
    expect(localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)).not.toBeNull();
    expect(planStoredSessionBoot(stored, false).action).toBe('clear');

    clearStoredAuthSession();
    expect(hasStoredAuthSession()).toBe(false);
    expect(readStoredAuthSession()).toBeNull();
  });

  it('keeps the profile when BFF can try the refresh cookie, and clears it after a 401', () => {
    persistAuthSession(
      { ...base, accessToken: 'access', refreshToken: 'refresh' },
      {
        storeRefreshToken: false,
      },
    );
    const stored = readStoredAuthSession();
    if (!stored) {
      throw new Error('expected a stored profile');
    }
    expect(planStoredSessionBoot(stored, true).action).toBe('refresh');

    const failure = new Error('HTTP 401');
    expect(isUnauthorizedRefreshError(failure)).toBe(true);
    if (isUnauthorizedRefreshError(failure)) {
      clearStoredAuthSession();
    }
    expect(hasStoredAuthSession()).toBe(false);
  });
});
