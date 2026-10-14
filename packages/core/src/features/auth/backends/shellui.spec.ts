import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AuthSession } from '../types';
import { AuthRequestError } from '../utils/authRequestError';
import { createShellUIAuthBackend } from './shellui';

vi.mock('../../config/useConfig', () => ({ useConfig: () => ({ config: {} }) }));

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('shellui backend sendMagicLink', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    const storage = new Map<string, string>([['shellui_auth_client_device_id', 'device-1']]);
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test('posts to /api/v1/magic-link/request with company and redirect_to', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    await backend.sendMagicLink('ada@acme.com', '/login/callback?next=%2Fapps');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/api/v1/magic-link/request');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      company_id: 7,
      email: 'ada@acme.com',
      redirect_to: 'https://app.example.com/login/callback?next=%2Fapps',
      client_device_id: 'device-1',
    });
    expect(body).not.toHaveProperty('email_redirect_to');
    expect(body).not.toHaveProperty('language');
    expect(body).not.toHaveProperty('code_challenge');
    expect(body).not.toHaveProperty('code_challenge_method');
  });

  test('desktop magic link sends the custom scheme and an S256 challenge', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    await backend.sendMagicLink('ada@acme.com', '/login/callback', {
      redirectTo: 'shellui-playground://callback',
      codeChallenge: 'a'.repeat(43),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.redirect_to).toBe('shellui-playground://callback');
    expect(body.code_challenge).toBe('a'.repeat(43));
    expect(body.code_challenge_method).toBe('S256');
    expect(body).not.toHaveProperty('code_verifier');
  });

  test('sends the UI language so the email is localized', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    await backend.sendMagicLink('ada@acme.com', '/login/callback', { language: 'fr' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.language).toBe('fr');
  });

  test('throws AuthRequestError with error_code when disabled', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: 'Magic link sign-in is disabled for this company.',
        error_code: 'magic_link_disabled',
      }),
    );
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: '7',
    });

    const error = await backend.sendMagicLink('ada@acme.com', '/login/callback').catch((e) => e);
    expect(error).toBeInstanceOf(AuthRequestError);
    expect((error as AuthRequestError).message).toBe(
      'Magic link sign-in is disabled for this company.',
    );
    expect((error as AuthRequestError).code).toBe('magic_link_disabled');
  });

  test('requires a company id', async () => {
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    await expect(backend.sendMagicLink('ada@acme.com', '/login/callback')).rejects.toThrow(
      'Missing company_id for magic link request.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('shellui backend OAuth session', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test('web exchange posts auth_code and redirect_to only', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'header.payload.sig',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    );
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });
    await backend.exchangeOAuthSessionCode({
      authCode: 'session-code',
      redirectTo: 'https://app.example.com/login/callback',
      nowSeconds: 1_700_000_000,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/api/v1/oauth/session');
    expect(JSON.parse(init.body as string)).toEqual({
      auth_code: 'session-code',
      redirect_to: 'https://app.example.com/login/callback',
    });
  });

  test('desktop exchange adds code_verifier and nothing else', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'header.payload.sig',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    );
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });
    await backend.exchangeOAuthSessionCode({
      authCode: 'session-code',
      redirectTo: 'shellui-playground://callback',
      codeVerifier: 'verifier-value',
      nowSeconds: 1_700_000_000,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      auth_code: 'session-code',
      redirect_to: 'shellui-playground://callback',
      code_verifier: 'verifier-value',
    });
  });
});

describe('shellui backend startOAuth', () => {
  test('web redirect sends S256 code_challenge and never the verifier', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'https://app.example.com', assign },
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
    });
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    backend.startOAuth('github', '/login/callback', 4, { codeChallenge: 'a'.repeat(43) });

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(String(assign.mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.example.com/api/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('github');
    expect(url.searchParams.get('redirect_to')).toBe(
      'https://app.example.com/login/callback?provider=github&company_oauth_client_id=4',
    );
    expect(url.searchParams.get('company_id')).toBe('7');
    expect(url.searchParams.get('company_oauth_client_id')).toBe('4');
    expect(url.searchParams.get('code_challenge')).toBe('a'.repeat(43));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('code_verifier')).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('shellui backend refresh and logout', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test('refresh posts the refresh token and does not send PKCE fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'header.payload.sig',
        refresh_token: 'refresh-2',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    );
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });
    await backend.refreshAuthSession(
      {
        accessToken: 'old',
        refreshToken: 'refresh-1',
        expiresAt: 1,
        tokenType: 'bearer',
      } as AuthSession,
      1_700_000_000,
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/token?grant_type=refresh_token');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.refresh_token).toBe('refresh-1');
    expect(body).not.toHaveProperty('code_verifier');
    expect(body).not.toHaveProperty('code_challenge');
  });

  test('logout posts the access token and refresh token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });
    await backend.logout({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: 1,
      tokenType: 'bearer',
    } as AuthSession);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/api/v1/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'refresh-1' });
  });
});

describe('shellui backend updateProfile', () => {
  const fetchMock = vi.fn();
  const session = { accessToken: 'access-1' } as AuthSession;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test('sends PATCH /api/v1/user and returns the stored name', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user_metadata: { name: 'Ada Lovelace' } }));
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    const result = await backend.updateProfile(session, { name: ' Ada  Lovelace ' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/api/v1/user');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    expect(JSON.parse(init.body as string)).toEqual({ name: ' Ada  Lovelace ' });
    expect(result).toEqual({ name: 'Ada Lovelace' });
  });

  test('surfaces field validation messages', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { name: ['Name cannot be blank.'] }));
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    await expect(backend.updateProfile(session, { name: ' ' })).rejects.toThrow(
      'Name cannot be blank.',
    );
  });
});

describe('shellui backend deleteAccount', () => {
  const fetchMock = vi.fn();
  const session = { accessToken: 'access-1', refreshToken: 'refresh-1' } as AuthSession;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test('sends DELETE /api/v1/user with bearer token and no company id', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    await backend.deleteAccount(session);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/api/v1/user');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    expect(JSON.parse(init.body as string)).toEqual({ confirm: true, refresh_token: 'refresh-1' });
  });

  test('surfaces recent_login_required as an AuthRequestError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: 'Sign in again before deleting your account.',
        error_code: 'recent_login_required',
      }),
    );
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    const error = await backend.deleteAccount(session).catch((e) => e);
    expect(error).toBeInstanceOf(AuthRequestError);
    expect((error as AuthRequestError).code).toBe('recent_login_required');
  });

  test('keeps the companies list when the user is the last owner', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'You are the only owner of Acme. Add another owner before deleting your account.',
        error_code: 'last_company_owner',
        companies: [{ id: 7, name: 'Acme' }],
      }),
    );
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    const error = (await backend.deleteAccount(session).catch((e) => e)) as AuthRequestError;
    expect(error.code).toBe('last_company_owner');
    expect(error.details.companies).toEqual([{ id: 7, name: 'Acme' }]);
  });

  test('requires a session', async () => {
    const backend = createShellUIAuthBackend({ backendUrl: 'https://auth.example.com' });

    await expect(backend.deleteAccount(null)).rejects.toBeInstanceOf(AuthRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
