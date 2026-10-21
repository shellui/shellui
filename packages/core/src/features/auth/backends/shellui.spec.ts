import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AuthSession } from '../types';
import { AuthRequestError } from '../utils/authRequestError';
import { generateCodeChallenge } from '../utils/pkce';
import { WEB_PKCE_FLOW_PARAM, takeWebPkceVerifier } from '../utils/webPkce';
import { createShellUIAuthBackend } from './shellui';

vi.mock('../../config/useConfig', () => ({ useConfig: () => ({ config: {} }) }));

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function memoryStorage(seed: [string, string][] = []): Storage {
  const map = new Map<string, string>(seed);
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe('shellui backend sendMagicLink', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    vi.stubGlobal('localStorage', memoryStorage([['shellui_auth_client_device_id', 'device-1']]));
    vi.stubGlobal('sessionStorage', memoryStorage());
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
      client_device_id: 'device-1',
      code_challenge_method: 'S256',
    });
    const redirect = new URL(body.redirect_to as string);
    expect(`${redirect.origin}${redirect.pathname}`).toBe('https://app.example.com/login/callback');
    expect(redirect.searchParams.get('next')).toBe('/apps');
    const flowId = redirect.searchParams.get(WEB_PKCE_FLOW_PARAM);
    expect(flowId).toMatch(/^m[0-9a-f]{32}$/);
    expect(body.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body).not.toHaveProperty('code_verifier');
    expect(body).not.toHaveProperty('email_redirect_to');
    expect(body).not.toHaveProperty('language');
    // The verifier waits in localStorage for the tab the email link opens.
    const verifier = takeWebPkceVerifier(flowId);
    expect(verifier).toBeTruthy();
    expect(body.redirect_to as string).not.toContain(verifier as string);
    expect(body.code_challenge).toBe(await generateCodeChallenge(verifier as string));
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
    // The browser sets Origin. The exchange is a plain cross-origin POST.
    expect(init.credentials).toBeUndefined();
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('Origin');
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
  test('sends an S256 challenge and keeps the verifier out of the URL', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'https://app.example.com', assign },
    });
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    const backend = createShellUIAuthBackend({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
    });

    await backend.startOAuth('github', '/login/callback', 4);

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(String(assign.mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.example.com/api/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('github');
    const redirect = new URL(url.searchParams.get('redirect_to') as string);
    expect(redirect.searchParams.get('provider')).toBe('github');
    expect(redirect.searchParams.get('company_oauth_client_id')).toBe('4');
    const flowId = redirect.searchParams.get(WEB_PKCE_FLOW_PARAM);
    expect(flowId).toMatch(/^o[0-9a-f]{32}$/);
    expect(url.searchParams.get('company_id')).toBe('7');
    expect(url.searchParams.get('company_oauth_client_id')).toBe('4');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('code_verifier')).toBe(false);
    expect(localStorage.getItem(`shellui.auth.pkce.magic.${flowId}`)).toBeNull();
    const verifier = takeWebPkceVerifier(flowId);
    expect(verifier).toBeTruthy();
    expect(url.toString()).not.toContain(verifier as string);
    expect(url.searchParams.get('code_challenge')).toBe(
      await generateCodeChallenge(verifier as string),
    );
    vi.unstubAllGlobals();
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
