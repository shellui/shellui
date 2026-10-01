import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
