import { describe, expect, test } from 'vitest';
import http from 'http';
import {
  LOGIN_NONCE_HEADER,
  buildAuthorizeUrl,
  buildCallbackPageHtml,
  buildWaitingPageHtml,
  generateLoginNonce,
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
    expect(callback).toContain('/api/v1/oauth/session');
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
