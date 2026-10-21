import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/useConfig', () => ({ useConfig: () => ({ config: {} }) }));
import { createAuthBackend } from '../backends';
import type { AuthSession } from '../types';
import { AUTH_REFRESH_STORAGE_KEY } from '../utils/authStorageKeys';
import {
  APP_BACKEND_REFRESH_PREFIX,
  endAppBackendSessions,
  ensureAppBackendSession,
  getAppBackendSession,
  setAppBackendFactory,
  setAppBackendSignIn,
} from './appBackendSessions';
import { resolveAppBackendConfig } from './identity';
import { runSilentPkceSignIn } from './silentSignIn';

const SHELL_TOKEN = 'shell-access-token';
const FOREIGN_TOKEN = 'foreign-access-token';
const FOREIGN_REFRESH = 'foreign-refresh-token';

function session(accessToken: string, refreshToken = FOREIGN_REFRESH): AuthSession {
  return {
    accessToken,
    refreshToken,
    tokenType: 'bearer',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    provider: 'google',
    userId: 'user-foreign',
    userEmail: 'foreign@example.com',
    userName: 'Foreign',
    userAvatarUrl: null,
    userIsStaff: false,
    userIsCompanyOwner: false,
    userGroups: ['directory'],
  };
}

function identityFor(url: string, companyId?: number) {
  const identity = resolveAppBackendConfig(
    { url, companyId, provider: 'google', type: 'shellui' },
    { backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 } },
  );
  if (!identity) throw new Error('expected identity');
  return identity;
}

function installStorage(): Storage {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  } as Storage;
  vi.stubGlobal('sessionStorage', storage);
  return storage;
}

describe('app backend sessions', () => {
  const refreshAuthSession = vi.fn();
  const exchangeOAuthSessionCode = vi.fn();
  const logout = vi.fn(async () => {});
  const factory = vi.fn(() => ({ refreshAuthSession, exchangeOAuthSessionCode, logout }));
  const signIn = vi.fn();

  beforeEach(() => {
    installStorage();
    refreshAuthSession.mockReset();
    exchangeOAuthSessionCode.mockReset();
    logout.mockClear();
    factory.mockClear();
    signIn.mockReset();
    signIn.mockResolvedValue({ ok: false, reason: 'not-configured' });
    setAppBackendFactory(factory);
    setAppBackendSignIn(signIn);
  });

  afterEach(async () => {
    await endAppBackendSessions();
    setAppBackendFactory(createAuthBackend);
    setAppBackendSignIn(runSilentPkceSignIn);
    vi.unstubAllGlobals();
  });

  it('stores only the refresh token and keeps two servers apart', async () => {
    const directory = identityFor('https://id.directory.example', 4);
    const billing = identityFor('https://id.billing.example', 8);
    signIn.mockImplementation(async (input: { backendUrl: string }) => ({
      ok: true,
      authCode: `code-${input.backendUrl}`,
      redirectTo: 'https://shell.example/login/callback?shellui_silent=1',
      codeVerifier: 'verifier-value-verifier-value-verifier-value',
    }));
    exchangeOAuthSessionCode.mockImplementation(async ({ authCode }: { authCode: string }) =>
      session(
        authCode === 'code-https://id.directory.example' ? FOREIGN_TOKEN : 'billing-token',
        `refresh-${authCode}`,
      ),
    );

    const directoryToken = await ensureAppBackendSession(directory, { allowSilent: true });
    const billingToken = await ensureAppBackendSession(billing, { allowSilent: true });

    expect(directoryToken).toBe(FOREIGN_TOKEN);
    expect(billingToken).toBe('billing-token');
    expect(getAppBackendSession(directory.key)?.accessToken).toBe(FOREIGN_TOKEN);
    expect(getAppBackendSession(billing.key)?.accessToken).toBe('billing-token');
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://id.directory.example' }),
    );
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://id.billing.example' }),
    );
    expect(JSON.stringify(factory.mock.calls)).not.toContain(SHELL_TOKEN);

    const stored = JSON.stringify(
      Object.fromEntries(
        [...Array(sessionStorage.length).keys()].map((index) => {
          const key = sessionStorage.key(index) ?? '';
          return [key, sessionStorage.getItem(key)];
        }),
      ),
    );
    expect(stored).not.toContain(FOREIGN_TOKEN);
    expect(stored).not.toContain('billing-token');
    expect(stored).toContain('refresh-code-https://id.directory.example');
    expect(signIn.mock.calls[0][0]).not.toHaveProperty('accessToken');
  });

  it('refreshes a stored session without silent sign-in', async () => {
    const directory = identityFor('https://id.directory.example', 4);
    sessionStorage.setItem(
      `${APP_BACKEND_REFRESH_PREFIX}${encodeURIComponent(directory.key)}`,
      'stored-refresh',
    );
    refreshAuthSession.mockResolvedValue(session(FOREIGN_TOKEN, 'rotated-refresh'));

    const token = await ensureAppBackendSession(directory, { allowSilent: true });

    expect(token).toBe(FOREIGN_TOKEN);
    expect(signIn).not.toHaveBeenCalled();
    expect(exchangeOAuthSessionCode).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem(`${APP_BACKEND_REFRESH_PREFIX}${encodeURIComponent(directory.key)}`),
    ).toBe('rotated-refresh');
  });

  it('does not silent-sign-in a supabase override', async () => {
    const identity = resolveAppBackendConfig(
      {
        type: 'supabase',
        url: 'https://abc.supabase.co',
        publishableKey: 'pk',
        provider: 'google',
      },
      { backend: { type: 'shellui', url: 'https://id.example.com' } },
    );
    if (!identity) throw new Error('expected identity');
    const token = await ensureAppBackendSession(identity, { allowSilent: true });
    expect(token).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('clears app refresh tokens and leaves the shell refresh token', async () => {
    const directory = identityFor('https://id.directory.example', 4);
    signIn.mockResolvedValue({
      ok: true,
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback?shellui_silent=1',
      codeVerifier: 'verifier-value-verifier-value-verifier-value',
    });
    exchangeOAuthSessionCode.mockResolvedValue(session(FOREIGN_TOKEN));
    await ensureAppBackendSession(directory, { allowSilent: true });
    sessionStorage.setItem(AUTH_REFRESH_STORAGE_KEY, 'shell-refresh');

    await endAppBackendSessions();

    expect(getAppBackendSession(directory.key)).toBeNull();
    expect(sessionStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBe('shell-refresh');
    expect(logout).toHaveBeenCalledWith(expect.objectContaining({ accessToken: FOREIGN_TOKEN }));
    const dumped = JSON.stringify(
      [...Array(sessionStorage.length).keys()].map((index) => sessionStorage.key(index)),
    );
    expect(dumped).not.toContain(APP_BACKEND_REFRESH_PREFIX);
  });
});
