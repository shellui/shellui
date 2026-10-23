import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TYPE,
  TOKEN_EXCHANGE_GRANT,
  describeAppSessionFailure,
  exchangeShellTokenForAppSession,
} from './tokenExchange';

const NOW = 1_800_000_000;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('exchangeShellTokenForAppSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts an RFC 8693 request to the regional server and returns its session', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'regional-access',
        refresh_token: 'regional-refresh',
        token_type: 'Bearer',
        issued_token_type: ACCESS_TOKEN_TYPE,
        expires_in: 300,
        expires_at: NOW + 300,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await exchangeShellTokenForAppSession({
      backendUrl: 'https://id.eu.example',
      companyId: 5,
      shellAccessToken: 'global-access',
      nowSeconds: NOW,
    });

    expect(outcome.ok && outcome.session.accessToken).toBe('regional-access');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://id.eu.example/oauth/token');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('grant_type')).toBe(TOKEN_EXCHANGE_GRANT);
    expect(body.get('subject_token')).toBe('global-access');
    expect(body.get('subject_token_type')).toBe(ACCESS_TOKEN_TYPE);
    expect(body.get('company_id')).toBe('5');
    expect(url).not.toContain('global-access');
  });

  it('refuses without a numeric company id and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await exchangeShellTokenForAppSession({
      backendUrl: 'https://id.eu.example',
      shellAccessToken: 'global-access',
      nowSeconds: NOW,
    });
    expect(outcome).toEqual({ ok: false, reason: 'missing_company_id' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the server error without the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(400, { error: 'invalid_grant', error_description: 'User is not a member.' }),
      ),
    );
    const outcome = await exchangeShellTokenForAppSession({
      backendUrl: 'https://id.eu.example',
      companyId: '5',
      shellAccessToken: 'global-access',
      nowSeconds: NOW,
    });
    expect(outcome).toEqual({ ok: false, reason: 'invalid_grant: User is not a member.' });
    expect(describeAppSessionFailure('invalid_grant: User is not a member.')).toBeTruthy();
  });

  it('reports a server without token exchange', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, {})),
    );
    const outcome = await exchangeShellTokenForAppSession({
      backendUrl: 'https://id.eu.example',
      companyId: 5,
      shellAccessToken: 'global-access',
      nowSeconds: NOW,
    });
    expect(outcome).toEqual({ ok: false, reason: 'token_exchange_unavailable' });
  });
});
