import { afterEach, describe, expect, test, vi } from 'vitest';
import crypto from 'crypto';
import http from 'http';
import {
  LOGIN_NONCE_HEADER,
  buildAuthorizeUrl,
  buildCallbackPageHtml,
  buildWaitingPageHtml,
  exchangeSessionCode,
  generateLoginNonce,
  generatePkcePair,
  validateCaptureNonce,
} from '../login-flow.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('login-flow nonce helpers', () => {
  test('generateLoginNonce returns 64-char hex', () => {
    const nonce = generateLoginNonce();
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(generateLoginNonce()).not.toBe(nonce);
  });

  test('validateCaptureNonce requires exact match', () => {
    const nonce = generateLoginNonce();
    expect(validateCaptureNonce({ nonce }, nonce)).toBe(true);
    expect(validateCaptureNonce({ nonce: 'wrong' }, nonce)).toBe(false);
    expect(validateCaptureNonce({}, nonce)).toBe(false);
  });

  test('buildAuthorizeUrl includes state when provided', () => {
    const url = buildAuthorizeUrl({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      redirectTo: 'http://127.0.0.1:9/callback',
      state: 'abc123',
    });
    expect(url).toContain('state=abc123');
  });

  test('waiting and callback pages embed port and nonce', () => {
    const nonce = 'deadbeef';
    const waiting = buildWaitingPageHtml({
      port: 4242,
      nonce,
      backendUrl: 'https://id.shellui.com',
    });
    expect(waiting).toContain('4242');
    expect(waiting).toContain(nonce);
    expect(waiting).toContain('/api/v1/authorize');

    const callback = buildCallbackPageHtml({
      nonce,
      backendUrl: 'https://id.shellui.com',
    });
    expect(callback).toContain(nonce);
    expect(callback).toContain(LOGIN_NONCE_HEADER);
    expect(callback).toContain('/capture');
    expect(callback).toContain('shellui_auth_code');
    expect(callback).toContain("'/code'");
    // The browser no longer redeems the code; the CLI does, with the verifier.
    expect(callback).not.toContain('/api/v1/oauth/session');
    expect(callback).not.toContain('code_verifier');
  });
});

describe('login-flow PKCE', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('generatePkcePair returns an S256 pair', () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const expected = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(challenge).toBe(expected);
    expect(generatePkcePair().verifier).not.toBe(verifier);
  });

  test('buildAuthorizeUrl sends the challenge, never the verifier', () => {
    const { verifier, challenge } = generatePkcePair();
    const url = new URL(
      buildAuthorizeUrl({
        backendUrl: 'https://id.shellui.com',
        companyId: '1',
        redirectTo: 'http://127.0.0.1:9/callback',
        codeChallenge: challenge,
      }),
    );
    expect(url.searchParams.get('code_challenge')).toBe(challenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.toString()).not.toContain(verifier);
  });

  test('exchangeSessionCode posts the verifier with the loopback Origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: 5 }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const tokens = await exchangeSessionCode({
      backendUrl: 'https://id.shellui.com/',
      authCode: 'code-1',
      redirectTo: 'http://127.0.0.1:4242/callback',
      codeVerifier: 'v'.repeat(43),
    });
    expect(tokens.access_token).toBe('a');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://id.shellui.com/api/v1/oauth/session');
    expect(init.headers.Origin).toBe('http://127.0.0.1:4242');
    expect(JSON.parse(init.body)).toEqual({
      auth_code: 'code-1',
      redirect_to: 'http://127.0.0.1:4242/callback',
      code_verifier: 'v'.repeat(43),
    });
  });

  test('exchangeSessionCode surfaces the PKCE error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'PKCE failed.', error_code: 'pkce_verification_failed' }),
          {
            status: 400,
          },
        ),
      ),
    );
    await expect(
      exchangeSessionCode({
        backendUrl: 'https://id.shellui.com',
        authCode: 'c',
        redirectTo: 'http://127.0.0.1:1/callback',
        codeVerifier: 'v'.repeat(43),
      }),
    ).rejects.toThrow('PKCE failed. (pkce_verification_failed)');
  });
});

describe('login-flow /capture binding', () => {
  test('rejects POST /capture without nonce', async () => {
    const loginNonce = generateLoginNonce();
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/capture') {
        res.writeHead(404);
        res.end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        if (!validateCaptureNonce(payload, loginNonce)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: 'a',
          refresh_token: 'r',
        }),
      });
      expect(res.status).toBe(403);
    } finally {
      await closeServer(server);
    }
  });

  test('accepts POST /capture with matching nonce', async () => {
    const loginNonce = generateLoginNonce();
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/capture') {
        res.writeHead(404);
        res.end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        const header = req.headers[LOGIN_NONCE_HEADER.toLowerCase()];
        const ok =
          header === loginNonce &&
          validateCaptureNonce(payload, loginNonce) &&
          payload.access_token &&
          payload.refresh_token;
        if (!ok) {
          res.writeHead(403);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [LOGIN_NONCE_HEADER]: loginNonce,
        },
        body: JSON.stringify({
          nonce: loginNonce,
          access_token: 'access',
          refresh_token: 'refresh',
        }),
      });
      expect(res.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });
});
