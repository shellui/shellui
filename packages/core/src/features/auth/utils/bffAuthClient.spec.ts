import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../types';
import { AUTH_PROFILE_STORAGE_KEY, AUTH_REFRESH_STORAGE_KEY } from './authStorageKeys';
import { persistAuthSession, readStoredAuthSession } from './authSessionPersistence';
import { AuthRequestError } from './authRequestError';
import { isUnauthorizedRefreshError, planStoredSessionBoot } from './canRestoreStoredSession';
import {
  exchangeAuthCodeViaBff,
  exchangeShellSessionCode,
  logoutBffAuthSession,
  probeBffAuthRoutes,
  refreshBffAuthSession,
  rememberHostCookieSession,
  resetBffRouteProbeForTests,
  resolveBffAuthRoutes,
} from './bffAuthClient';

const now = 1_700_000_000;

function accessJwt(email = 'ada@example.com') {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', email, user_metadata: { name: 'Ada' } }),
  ).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

function storageMock(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

function jsonResponse(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: async () => body,
  } as unknown as Response;
}

const baseSession = (): AuthSession => ({
  accessToken: accessJwt(),
  refreshToken: '',
  tokenType: 'bearer',
  expiresAt: now + 300,
  provider: 'github',
  userId: 'user-1',
  userEmail: 'ada@example.com',
  userName: 'Ada',
  userAvatarUrl: null,
  userIsStaff: false,
  userIsCompanyOwner: false,
  userGroups: [],
});

describe('host cookie session', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetBffRouteProbeForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { origin: 'https://shell.example' } });
    vi.stubGlobal('localStorage', storageMock());
    vi.stubGlobal('sessionStorage', storageMock());
  });

  afterEach(() => {
    resetBffRouteProbeForTests();
    vi.unstubAllGlobals();
  });

  it('exchanges the auth code on the host and stores no refresh token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: accessJwt(),
        refresh_token: 'refresh-secret',
        expires_in: 300,
        token_type: 'bearer',
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' },
      }),
    );

    const session = await exchangeAuthCodeViaBff({
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback',
      codeVerifier: 'verifier-1',
      nowSeconds: now,
    });
    if (!session) throw new Error('expected a session');
    const stored = rememberHostCookieSession(session);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/session');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({
      auth_code: 'code-1',
      redirect_to: 'https://shell.example/login/callback',
      code_verifier: 'verifier-1',
    });
    expect(stored.refreshToken).toBe('');
    expect(stored.accessToken).toBe(accessJwt());
    expect(stored.userEmail).toBe('ada@example.com');
    expect(sessionStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBeNull();
    const profile = localStorage.getItem(AUTH_PROFILE_STORAGE_KEY) ?? '';
    expect(profile).not.toContain('refresh-secret');
    expect(profile).not.toContain(accessJwt());
  });

  it('refreshes from the cookie and still does not keep a refresh token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: accessJwt('ada@example.com'),
        refresh_token: 'rotated-refresh',
        expires_in: 300,
        token_type: 'bearer',
      }),
    );
    const next = await refreshBffAuthSession(baseSession(), now);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(next?.refreshToken).toBe('');
    expect(next?.accessToken).toContain('eyJ');
    expect(JSON.stringify(next)).not.toContain('rotated-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs out through the host without sending a refresh token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, {}));
    await logoutBffAuthSession('access-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.stringify(init.headers)).not.toContain('refresh');
  });

  it('restores a new tab from the profile and the host cookie', async () => {
    rememberHostCookieSession({ ...baseSession(), refreshToken: 'must-not-stick' });
    const stored = readStoredAuthSession();
    if (!stored) throw new Error('expected a stored profile');
    expect(stored.accessToken).toBe('');
    expect(stored.refreshToken).toBe('');
    expect(planStoredSessionBoot(stored, true)).toEqual({ action: 'refresh', session: stored });

    const renewed = accessJwt();
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: renewed,
        refresh_token: 'rotated-refresh',
        expires_in: 300,
      }),
    );
    const next = await refreshBffAuthSession(stored, now);
    if (!next) throw new Error('expected a refreshed session');
    rememberHostCookieSession(next);
    expect(next.accessToken).toBe(renewed);
    expect(next.refreshToken).toBe('');
    expect(sessionStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)).not.toContain('rotated-refresh');
  });

  it('treats a missing cookie as one failed refresh, not a retry loop', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'missing refresh cookie' }));
    const error = await refreshBffAuthSession(baseSession(), now).catch((err) => err);
    expect(isUnauthorizedRefreshError(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back once when the host routes are absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, '<html></html>', 'text/html'));
    const direct = vi.fn(async () => ({ ...baseSession(), refreshToken: 'direct-refresh' }));
    const session = await exchangeShellSessionCode({
      useBff: true,
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback',
      codeVerifier: 'verifier-1',
      nowSeconds: now,
      exchangeDirect: direct,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(direct).toHaveBeenCalledTimes(1);
    expect(session?.refreshToken).toBe('direct-refresh');

    fetchMock.mockClear();
    direct.mockClear();
    const again = await resolveBffAuthRoutes({ backendType: 'shellui', explicitlyDisabled: false });
    expect(again).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not exchange the code again when identity returns 400 without error_code', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Origin does not match redirect_to.' }));
    const direct = vi.fn();
    const error = await exchangeShellSessionCode({
      useBff: true,
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback',
      codeVerifier: 'verifier-1',
      nowSeconds: now,
      exchangeDirect: direct,
    }).catch((err) => err);
    expect(error).toBeInstanceOf(AuthRequestError);
    expect((error as AuthRequestError).code).toBeNull();
    expect(direct).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back when identity rejects the code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'Auth code already used.', error_code: 'auth_code_used' }),
    );
    const direct = vi.fn();
    const error = await exchangeShellSessionCode({
      useBff: true,
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback',
      nowSeconds: now,
      exchangeDirect: direct,
    }).catch((err) => err);
    expect(error).toBeInstanceOf(AuthRequestError);
    expect((error as AuthRequestError).code).toBe('auth_code_used');
    expect(direct).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probes once and treats HTML as routes absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, '<!doctype html>', 'text/html; charset=utf-8'));
    expect(await probeBffAuthRoutes()).toBe(false);
    expect(await probeBffAuthRoutes()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('uses the host when the probe reports ready', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ready: true }));
    expect(await resolveBffAuthRoutes({ backendType: 'shellui', explicitlyDisabled: false })).toBe(
      true,
    );
  });

  it('does not probe when BFF is explicitly off', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ready: true }));
    expect(await resolveBffAuthRoutes({ backendType: 'shellui', explicitlyDisabled: true })).toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves Supabase on the direct session', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ready: true }));
    expect(await resolveBffAuthRoutes({ backendType: 'supabase', explicitlyDisabled: false })).toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('default mode without the host', () => {
  beforeEach(() => {
    resetBffRouteProbeForTests();
    vi.stubGlobal('localStorage', storageMock());
    vi.stubGlobal('sessionStorage', storageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges on the page and stores the refresh token', async () => {
    const direct = vi.fn(async () => ({ ...baseSession(), refreshToken: 'page-refresh' }));
    const session = await exchangeShellSessionCode({
      useBff: false,
      authCode: 'code-1',
      redirectTo: 'https://shell.example/login/callback',
      nowSeconds: now,
      exchangeDirect: direct,
    });
    if (!session) throw new Error('expected a session');
    persistAuthSession(session);
    expect(direct).toHaveBeenCalledTimes(1);
    expect(session.refreshToken).toBe('page-refresh');
    expect(sessionStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBe('page-refresh');
    const stored = readStoredAuthSession();
    expect(stored?.refreshToken).toBe('page-refresh');
    expect(stored?.accessToken).toBe('');
  });
});
