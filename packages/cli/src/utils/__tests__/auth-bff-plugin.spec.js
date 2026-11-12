import http from 'http';
import { afterEach, describe, expect, test } from 'vitest';
import {
  buildRefreshCookie,
  devBffCookieSecure,
  dispatchAuthBff,
  isBffHostEnabled,
  originOfRedirectTo,
  publicSessionPayload,
  resolveBffUpstreamUrl,
  resolveShellOrigin,
} from '../auth-bff-plugin.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../');

const envSnapshot = {
  NODE_ENV: process.env.NODE_ENV,
  SHELLUI_BFF_SECURE_COOKIE: process.env.SHELLUI_BFF_SECURE_COOKIE,
  SHELLUI_BFF_BACKEND_URL: process.env.SHELLUI_BFF_BACKEND_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('dev BFF cookie', () => {
  test('omits Secure on http, even when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SHELLUI_BFF_SECURE_COOKIE;
    expect(devBffCookieSecure({ headers: {}, socket: {} })).toBe(false);
    expect(buildRefreshCookie('shellui_refresh', 'abc', { secure: false })).not.toContain('Secure');
  });

  test('sets Secure for https or when the flag is on', () => {
    delete process.env.SHELLUI_BFF_SECURE_COOKIE;
    expect(devBffCookieSecure({ headers: { 'x-forwarded-proto': 'https' }, socket: {} })).toBe(
      true,
    );
    expect(devBffCookieSecure({ headers: { 'x-forwarded-proto': 'http' }, socket: {} })).toBe(
      false,
    );
    process.env.SHELLUI_BFF_SECURE_COOKIE = '1';
    expect(devBffCookieSecure({ headers: {}, socket: {} })).toBe(true);
    expect(buildRefreshCookie('shellui_refresh', 'abc', { secure: true })).toContain('Secure');
    process.env.SHELLUI_BFF_SECURE_COOKIE = '0';
    expect(
      devBffCookieSecure({
        headers: { 'x-forwarded-proto': 'https' },
        socket: { encrypted: true },
      }),
    ).toBe(false);
  });
});

describe('resolveBffUpstreamUrl', () => {
  test('uses backend.url unless the dev container override is set', () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    expect(resolveBffUpstreamUrl('http://localhost:8001/')).toBe('http://localhost:8001');
    process.env.SHELLUI_BFF_BACKEND_URL = 'http://identity:8000/';
    expect(resolveBffUpstreamUrl('http://localhost:8001')).toBe('http://identity:8000');
  });
});

describe('dev stack BFF config', () => {
  test('enables bff auth and points container refresh at identity', () => {
    const security = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'dev/config/shellui.security.config.json'), 'utf8'),
    );
    expect(security.security.bffAuth.enabled).toBe(true);
    const compose = fs.readFileSync(path.join(repoRoot, 'dev/docker-compose.yml'), 'utf8');
    expect(compose).toContain('SHELLUI_BFF_BACKEND_URL: http://identity:8000');
    const entry = fs.readFileSync(
      path.join(repoRoot, 'dev/container/shell-dev-entrypoint.sh'),
      'utf8',
    );
    expect(entry).toContain('packages/cli/bin/shellui.js start');
  });
});

function accessJwt() {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-1',
      email: 'ada@example.com',
      user_metadata: { name: 'Ada' },
    }),
  ).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

function readReqBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function withIdentity(onRequest) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readReqBody(req);
    const body = raw ? JSON.parse(raw) : {};
    requests.push({
      url: req.url,
      origin: req.headers.origin ?? null,
      cookie: req.headers.cookie ?? null,
      authorization: req.headers.authorization ?? null,
      body,
    });
    const result = onRequest(requests.at(-1));
    res.statusCode = result.status ?? 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result.body ?? {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    requests,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function shellConfig(url, security = {}) {
  return {
    backend: { type: 'shellui', url },
    security,
  };
}

describe('host BFF is on unless explicitly disabled', () => {
  test('mounts routes when enabled is omitted and a backend URL is set', () => {
    expect(isBffHostEnabled({ backend: { url: 'http://localhost:8001' } })).toBe(true);
    expect(isBffHostEnabled({ backend: { url: 'http://localhost:8001' }, security: {} })).toBe(
      true,
    );
    expect(
      isBffHostEnabled({
        backend: { url: 'http://localhost:8001' },
        security: { bffAuth: { enabled: true } },
      }),
    ).toBe(true);
  });

  test('stays off when enabled is false or there is no backend URL', () => {
    expect(
      isBffHostEnabled({
        backend: { url: 'http://localhost:8001' },
        security: { bffAuth: { enabled: false } },
      }),
    ).toBe(false);
    expect(isBffHostEnabled({ security: { bffAuth: { enabled: true } } })).toBe(false);
  });
});

describe('originOfRedirectTo', () => {
  test('is the shell origin of an http(s) callback', () => {
    expect(originOfRedirectTo('https://shell.example/login/callback?next=%2Fapps')).toEqual({
      invalid: false,
      origin: 'https://shell.example',
    });
  });

  test('omits Origin for a desktop custom scheme', () => {
    expect(originOfRedirectTo('shellui-playground://callback')).toEqual({
      invalid: false,
      origin: null,
    });
  });
});

describe('resolveShellOrigin', () => {
  test('uses the browser Origin and not the identity host', () => {
    expect(
      resolveShellOrigin({
        origin: 'https://shell.example',
        host: 'identity.internal:8000',
      }),
    ).toBe('https://shell.example');
  });

  test('falls back to the forwarded shell host', () => {
    expect(
      resolveShellOrigin({
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'shell.example',
      }),
    ).toBe('https://shell.example');
  });
});

describe('publicSessionPayload', () => {
  test('drops the refresh token', () => {
    const payload = publicSessionPayload({
      access_token: accessJwt(),
      refresh_token: 'refresh-secret',
      expires_in: 300,
      token_type: 'bearer',
    });
    expect(payload).not.toHaveProperty('refresh_token');
    expect(JSON.stringify(payload)).not.toContain('refresh-secret');
    expect(payload.user).toEqual({ id: 'user-1', email: 'ada@example.com', name: 'Ada' });
  });
});

describe('dispatchAuthBff code exchange', () => {
  test('exchanges the code with the shell Origin and hides the refresh token', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const identity = await withIdentity(() => ({
      body: {
        access_token: accessJwt(),
        refresh_token: 'refresh-secret',
        expires_in: 300,
        token_type: 'bearer',
      },
    }));
    try {
      const result = await dispatchAuthBff({
        method: 'POST',
        pathname: '/session',
        headers: {
          origin: 'https://other.example',
          cookie: 'shellui_refresh=browser-cookie',
        },
        body: {
          auth_code: 'code-1',
          redirect_to: 'https://shell.example/login/callback',
          code_verifier: 'verifier-1',
          refresh_token: 'should-not-forward',
        },
        shelluiConfig: shellConfig(identity.url),
        secure: true,
      });
      expect(identity.requests).toHaveLength(1);
      expect(identity.requests[0].url).toBe('/api/v1/oauth/session');
      expect(identity.requests[0].origin).toBe('https://shell.example');
      expect(identity.requests[0].cookie).toBeNull();
      expect(identity.requests[0].body).toEqual({
        auth_code: 'code-1',
        redirect_to: 'https://shell.example/login/callback',
        code_verifier: 'verifier-1',
      });
      expect(result.status).toBe(200);
      const setCookie = result.headers['Set-Cookie'];
      expect(setCookie).toContain('shellui_refresh=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api/auth');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain(encodeURIComponent('refresh-secret'));
      expect(result.body).not.toContain('refresh-secret');
      expect(result.body).not.toContain('should-not-forward');
      const parsed = JSON.parse(result.body);
      expect(parsed.access_token).toBe(accessJwt());
      expect(parsed.expires_in).toBe(300);
      expect(parsed.user.email).toBe('ada@example.com');
      expect(parsed).not.toHaveProperty('refresh_token');
    } finally {
      await identity.close();
    }
  });

  test('forwards an origin mismatch without inventing error_code', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const identity = await withIdentity(() => ({
      status: 400,
      body: { error: 'Origin does not match redirect_to.' },
    }));
    try {
      const result = await dispatchAuthBff({
        method: 'POST',
        pathname: '/session',
        headers: {},
        body: {
          auth_code: 'code-1',
          redirect_to: 'https://shell.example/login/callback',
          code_verifier: 'verifier-1',
        },
        shelluiConfig: shellConfig(identity.url),
        secure: true,
      });
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Origin does not match redirect_to.' });
      expect(result.headers['Set-Cookie']).toBeUndefined();
    } finally {
      await identity.close();
    }
  });

  test('forwards a PKCE failure and its error_code', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const identity = await withIdentity(() => ({
      status: 400,
      body: { error: 'PKCE verification failed.', error_code: 'pkce_failed' },
    }));
    try {
      const result = await dispatchAuthBff({
        method: 'POST',
        pathname: '/session',
        headers: {},
        body: {
          auth_code: 'code-1',
          redirect_to: 'https://shell.example/login/callback',
          code_verifier: 'wrong',
        },
        shelluiConfig: shellConfig(identity.url),
        secure: false,
      });
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'PKCE verification failed.',
        error_code: 'pkce_failed',
      });
    } finally {
      await identity.close();
    }
  });

  test('refuses a refresh token posted by the page', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const result = await dispatchAuthBff({
      method: 'POST',
      pathname: '/session',
      headers: { origin: 'https://shell.example' },
      body: { refresh_token: 'from-the-page', access_token: 'access' },
      shelluiConfig: shellConfig('http://127.0.0.1:9'),
      secure: true,
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe('auth_code required');
    expect(result.headers['Set-Cookie']).toBeUndefined();
  });

  test('answers the route probe without calling identity', async () => {
    const result = await dispatchAuthBff({
      method: 'GET',
      pathname: '/session',
      headers: {},
      shelluiConfig: shellConfig('http://127.0.0.1:9'),
      secure: false,
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ready: true });
  });

  test('does not handle routes when the host is explicitly off', async () => {
    const result = await dispatchAuthBff({
      method: 'GET',
      pathname: '/session',
      headers: {},
      shelluiConfig: shellConfig('http://127.0.0.1:9', { bffAuth: { enabled: false } }),
      secure: false,
    });
    expect(result.handled).toBe(false);
  });
});

describe('dispatchAuthBff refresh and logout', () => {
  test('rotates the cookie and does not return the refresh token', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const identity = await withIdentity(() => ({
      body: {
        access_token: accessJwt(),
        refresh_token: 'new-refresh',
        expires_in: 300,
        token_type: 'bearer',
      },
    }));
    try {
      const result = await dispatchAuthBff({
        method: 'POST',
        pathname: '/refresh',
        headers: {
          origin: 'https://shell.example',
          cookie: 'shellui_refresh=old-refresh',
        },
        body: {},
        shelluiConfig: shellConfig(identity.url),
        secure: true,
      });
      expect(identity.requests[0].url).toBe('/api/v1/token?grant_type=refresh_token');
      expect(identity.requests[0].origin).toBeNull();
      expect(identity.requests[0].cookie).toBeNull();
      expect(identity.requests[0].body).toEqual({ refresh_token: 'old-refresh' });
      expect(result.status).toBe(200);
      expect(result.headers['Set-Cookie']).toContain(encodeURIComponent('new-refresh'));
      expect(result.body).not.toContain('new-refresh');
      expect(result.body).not.toContain('old-refresh');
      expect(JSON.parse(result.body).access_token).toBe(accessJwt());
    } finally {
      await identity.close();
    }
  });

  test('returns 401 when the refresh cookie is missing and does not call identity', async () => {
    const result = await dispatchAuthBff({
      method: 'POST',
      pathname: '/refresh',
      headers: { origin: 'https://shell.example' },
      body: {},
      shelluiConfig: shellConfig('http://127.0.0.1:9'),
      secure: true,
    });
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toBe('missing refresh cookie');
  });

  test('logout revokes with the cookie on the host and clears it', async () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    const identity = await withIdentity(() => ({ status: 200, body: { success: true } }));
    try {
      const result = await dispatchAuthBff({
        method: 'POST',
        pathname: '/logout',
        headers: {
          origin: 'https://shell.example',
          authorization: 'Bearer access-1',
          cookie: 'shellui_refresh=refresh-secret',
        },
        body: { refresh_token: 'from-the-page' },
        shelluiConfig: shellConfig(identity.url),
        secure: true,
      });
      expect(identity.requests).toHaveLength(1);
      expect(identity.requests[0].url).toBe('/api/v1/logout');
      expect(identity.requests[0].origin).toBeNull();
      expect(identity.requests[0].cookie).toBeNull();
      expect(identity.requests[0].authorization).toBe('Bearer access-1');
      expect(identity.requests[0].body).toEqual({ refresh_token: 'refresh-secret' });
      expect(result.status).toBe(204);
      expect(result.body).toBe('');
      expect(result.headers['Set-Cookie']).toContain('Max-Age=0');
      expect(result.headers['Set-Cookie']).toContain('HttpOnly');
    } finally {
      await identity.close();
    }
  });
});
