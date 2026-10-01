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
