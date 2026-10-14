import { describe, expect, test } from 'vitest';
import crypto from 'crypto';
import {
  LOGIN_NONCE_COOKIE,
  buildAuthorizeUrl,
  buildCallbackPageHtml,
  buildWaitingPageHtml,
  createLoginPkcePair,
  evaluateLoopbackCapture,
  generateLoginNonce,
  readRequestCookie,
  runLoginFlow,
  validateCaptureNonce,
} from '../login-flow.js';

function cookieFrom(response) {
  const listed =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = listed.length > 0 ? listed.join('; ') : response.headers.get('set-cookie') || '';
  return readRequestCookie(raw, LOGIN_NONCE_COOKIE);
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

  test('buildAuthorizeUrl sends S256 PKCE and not the verifier', () => {
    const { verifier, challenge } = createLoginPkcePair();
    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
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
    expect(url.searchParams.has('code_verifier')).toBe(false);
    expect(url.toString()).not.toContain(verifier);
  });

  test('served HTML does not include the session nonce', () => {
    const nonce = generateLoginNonce();
    const { verifier } = createLoginPkcePair();
    const waiting = buildWaitingPageHtml({
      port: 4242,
      backendUrl: 'https://id.shellui.com',
    });
    expect(waiting).toContain('4242');
    expect(waiting).toContain('/api/v1/authorize');
    expect(waiting).not.toContain(nonce);

    const callback = buildCallbackPageHtml({
      backendUrl: 'https://id.shellui.com',
      codeVerifier: verifier,
    });
    expect(callback).not.toContain(nonce);
    expect(callback).toContain('/capture');
    expect(callback).toContain('shellui_auth_code');
    expect(callback).toContain('/api/v1/oauth/session');
    expect(callback).toContain('code_verifier');
    expect(callback).toContain(verifier);
  });
});

describe('evaluateLoopbackCapture', () => {
  const nonce = 'a'.repeat(64);

  test('accepts only 127.0.0.1 origin and host after the callback was served', () => {
    const base = {
      port: 4311,
      host: '127.0.0.1:4311',
      origin: 'http://127.0.0.1:4311',
      cookie: nonce,
      expectedNonce: nonce,
      callbackServed: true,
      used: false,
    };
    expect(evaluateLoopbackCapture(base)).toBe('ok');
    expect(evaluateLoopbackCapture({ ...base, callbackServed: false })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, origin: undefined })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, origin: 'http://localhost:4311' })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, host: 'localhost:4311' })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, host: '127.0.0.1:4312' })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, cookie: 'nope' })).toBe('forbidden');
    expect(evaluateLoopbackCapture({ ...base, used: true })).toBe('used');
  });
});

describe('login-flow /capture binding', () => {
  test('accepts one capture from the loopback origin and rejects the rest', async () => {
    let resolvePort = () => {};
    const portReady = new Promise((resolve) => {
      resolvePort = resolve;
    });
    const pending = runLoginFlow({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      openBrowser: false,
      onReady: (info) => resolvePort(info.port),
    });

    const port = await portReady;
    expect(port).toBeGreaterThan(0);
    const origin = `http://127.0.0.1:${port}`;

    const waiting = await fetch(`${origin}/`);
    const waitingHtml = await waiting.text();

    const early = await fetch(`${origin}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify({ access_token: 'a', refresh_token: 'r' }),
    });
    expect(early.status).toBe(403);

    const callback = await fetch(`${origin}/callback`);
    const callbackHtml = await callback.text();
    const nonce = cookieFrom(callback);
    expect(nonce).toBeTruthy();
    expect(waitingHtml).not.toContain(nonce);
    expect(callbackHtml).not.toContain(nonce);
    expect(callbackHtml).toContain('code_verifier');

    const badJson = await fetch(`${origin}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Cookie: `${LOGIN_NONCE_COOKIE}=${encodeURIComponent(nonce)}`,
      },
      body: '{',
    });
    expect(badJson.status).toBe(400);

    const wrongOrigin = await fetch(`${origin}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:' + port,
        Cookie: `${LOGIN_NONCE_COOKIE}=${nonce}`,
      },
      body: JSON.stringify({ access_token: 'a', refresh_token: 'r' }),
    });
    expect(wrongOrigin.status).toBe(403);

    const ok = await fetch(`${origin}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Cookie: `${LOGIN_NONCE_COOKIE}=${encodeURIComponent(nonce)}`,
      },
      body: JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: 10 }),
    });
    expect(ok.status).toBe(200);
    await expect(pending).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 10,
    });
  });
});
