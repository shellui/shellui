import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../types';
import {
  AUTH_PROFILE_STORAGE_KEY,
  AUTH_REFRESH_STORAGE_KEY,
  LEGACY_AUTH_SESSION_STORAGE_KEY,
} from './authStorageKeys';
import {
  clearStoredAuthSession,
  persistAuthSession,
  readStoredAuthSession,
} from './authSessionPersistence';

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

const sampleSession = (): AuthSession => ({
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  tokenType: 'bearer',
  expiresAt: 4_102_444_800,
  provider: 'github',
  userId: 'user-1',
  userEmail: 'a@example.com',
  userName: 'Ada',
  userAvatarUrl: null,
  userIsStaff: false,
  userIsCompanyOwner: false,
  userGroups: [],
});

describe('authSessionPersistence', () => {
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

  it('stores profile in localStorage and refresh in sessionStorage', () => {
    persistAuthSession(sampleSession());
    expect(localStorage.setItem).toHaveBeenCalledWith(
      AUTH_PROFILE_STORAGE_KEY,
      expect.not.stringContaining('access-abc'),
    );
    expect(sessionStorage.setItem).toHaveBeenCalledWith(AUTH_REFRESH_STORAGE_KEY, 'refresh-xyz');
    expect(localStorage.removeItem).toHaveBeenCalledWith(LEGACY_AUTH_SESSION_STORAGE_KEY);
  });

  it('omits refresh from sessionStorage when storeRefreshToken is false (BFF)', () => {
    persistAuthSession(sampleSession(), { storeRefreshToken: false });
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(AUTH_REFRESH_STORAGE_KEY);
  });

  it('rehydrates session with empty access token until refresh', () => {
    persistAuthSession(sampleSession());
    const restored = readStoredAuthSession();
    expect(restored?.refreshToken).toBe('refresh-xyz');
    expect(restored?.accessToken).toBe('');
    expect(restored?.userId).toBe('user-1');
  });

  it('migrates legacy monolithic localStorage session', () => {
    const legacy = sampleSession();
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(legacy));
    const restored = readStoredAuthSession();
    expect(restored?.accessToken).toBe('access-abc');
    expect(localStorage.setItem).toHaveBeenCalledWith(AUTH_PROFILE_STORAGE_KEY, expect.any(String));
  });

  it('clears profile, refresh, and legacy keys', () => {
    clearStoredAuthSession();
    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_PROFILE_STORAGE_KEY);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(AUTH_REFRESH_STORAGE_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(LEGACY_AUTH_SESSION_STORAGE_KEY);
  });
});
