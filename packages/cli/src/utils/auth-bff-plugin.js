/**
 * Same-origin BFF routes for HttpOnly refresh cookies.
 * Phase 1: shell-side proxy; identity-service cookie endpoints are a follow-up.
 *
 * Routes:
 * - POST /api/auth/session  — accept refresh once, set HttpOnly cookie
 * - POST /api/auth/refresh  — rotate access token via cookie-stored refresh
 * - POST /api/auth/logout   — clear cookie (+ optional identity logout)
 */

import { resolveShellCspHeaders } from './csp.js';

const DEFAULT_COOKIE_NAME = 'shellui_refresh';
const COOKIE_PATH = '/api/auth';

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJsonBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
    return;
  }
  res.setHeader('Set-Cookie', [existing, cookie]);
}

function buildRefreshCookie(name, refreshToken, { secure }) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const flags = [
    `${name}=${encodeURIComponent(refreshToken)}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    flags.push('Secure');
  }
  return flags.join('; ');
}

function clearRefreshCookie(name, { secure }) {
  const flags = [`${name}=`, 'HttpOnly', 'SameSite=Lax', `Path=${COOKIE_PATH}`, 'Max-Age=0'];
  if (secure) {
    flags.push('Secure');
  }
  return flags.join('; ');
}

async function proxyShelluiRefresh(backendUrl, refreshToken) {
  const refreshUrl = new URL(`${backendUrl.replace(/\/+$/, '')}/api/v1/token`);
  refreshUrl.searchParams.set('grant_type', 'refresh_token');
  const response = await fetch(refreshUrl.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

async function proxySupabaseRefresh(backendUrl, publishableKey, refreshToken) {
  const refreshUrl = new URL(`${backendUrl.replace(/\/+$/, '')}/auth/v1/token`);
  refreshUrl.searchParams.set('grant_type', 'refresh_token');
  refreshUrl.searchParams.set('apikey', publishableKey);
  const response = await fetch(refreshUrl.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

function publicTokenPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const out = {};
  if (typeof payload.access_token === 'string') out.access_token = payload.access_token;
  if (typeof payload.expires_at === 'number' || typeof payload.expires_at === 'string') {
    out.expires_at = payload.expires_at;
  }
  if (typeof payload.expires_in === 'number' || typeof payload.expires_in === 'string') {
    out.expires_in = payload.expires_in;
  }
  if (typeof payload.token_type === 'string') out.token_type = payload.token_type;
  return out;
}

/**
 * @param {object} shelluiConfig
 */
export function authBffPlugin(shelluiConfig) {
  const enabled = shelluiConfig?.security?.bffAuth?.enabled === true;
  const backend = shelluiConfig?.backend;
  const cookieName = shelluiConfig?.security?.bffAuth?.cookieName || DEFAULT_COOKIE_NAME;

  return {
    name: 'shellui-auth-bff',
    configureServer(server) {
      if (!enabled || !backend?.url) {
        return;
      }

      const backendUrl = backend.url.replace(/\/+$/, '');
      const isSecure =
        process.env.NODE_ENV === 'production' ||
        backendUrl.startsWith('https://') ||
        process.env.SHELLUI_BFF_SECURE_COOKIE === '1';

      server.middlewares.use('/api/auth', async (req, res, next) => {
        if (!req.url?.startsWith('/')) {
          next();
          return;
        }

        const pathname = req.url.split('?')[0];
        const method = req.method ?? 'GET';

        if (method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          if (method === 'POST' && pathname === '/session') {
            const raw = await readRequestBody(req);
            const body = parseJsonBody(raw);
            if (!body || typeof body.refresh_token !== 'string' || !body.refresh_token) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'refresh_token required' }));
              return;
            }

            appendSetCookie(
              res,
              buildRefreshCookie(cookieName, body.refresh_token, { secure: isSecure }),
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                access_token: body.access_token,
                expires_at: body.expires_at,
                token_type: body.token_type ?? 'bearer',
              }),
            );
            return;
          }

          if (method === 'POST' && pathname === '/refresh') {
            const refreshToken = getCookieValue(req.headers.cookie, cookieName);
            if (!refreshToken) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'missing refresh cookie' }));
              return;
            }

            let result;
            if (backend.type === 'supabase') {
              if (!backend.publishableKey) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'missing publishableKey' }));
                return;
              }
              result = await proxySupabaseRefresh(backendUrl, backend.publishableKey, refreshToken);
            } else {
              result = await proxyShelluiRefresh(backendUrl, refreshToken);
            }

            if (!result.ok) {
              res.statusCode = result.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'refresh failed' }));
              return;
            }

            const nextRefresh =
              typeof result.payload?.refresh_token === 'string'
                ? result.payload.refresh_token
                : refreshToken;
            appendSetCookie(res, buildRefreshCookie(cookieName, nextRefresh, { secure: isSecure }));

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(publicTokenPayload(result.payload) ?? {}));
            return;
          }

          if (method === 'POST' && pathname === '/logout') {
            appendSetCookie(res, clearRefreshCookie(cookieName, { secure: isSecure }));
            const authHeader = req.headers.authorization;
            if (authHeader && backend.type === 'shellui') {
              await fetch(`${backendUrl}/api/v1/logout`, {
                method: 'POST',
                headers: { Accept: 'application/json', Authorization: authHeader },
              }).catch(() => {});
            }
            res.statusCode = 204;
            res.end();
            return;
          }

          next();
        } catch (error) {
          console.error('[shellui-auth-bff]', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'internal error' }));
        }
      });
    },
  };
}

function cspHeadersForConfig(shelluiConfig) {
  return resolveShellCspHeaders(shelluiConfig, { useScriptHash: true });
}

/**
 * Minimal auth BFF handler for serve-dist.mjs (production preview).
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} shelluiConfig
 * @returns {Promise<boolean>} true when handled
 */
export async function handleAuthBffRequest(req, res, shelluiConfig) {
  const enabled = shelluiConfig?.security?.bffAuth?.enabled === true;
  const backend = shelluiConfig?.backend;
  if (!enabled || !backend?.url) return false;

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/auth')) return false;

  const pathname = url.pathname.slice('/api/auth'.length) || '/';
  const method = req.method ?? 'GET';
  const cookieName = shelluiConfig?.security?.bffAuth?.cookieName || DEFAULT_COOKIE_NAME;
  const backendUrl = backend.url.replace(/\/+$/, '');
  const isSecure =
    process.env.SHELLUI_BFF_SECURE_COOKIE === '1' || backendUrl.startsWith('https://');

  if (method === 'POST' && pathname === '/session') {
    const raw = await readRequestBody(req);
    const body = parseJsonBody(raw);
    const csp = cspHeadersForConfig(shelluiConfig);
    if (!body || typeof body.refresh_token !== 'string') {
      res.writeHead(400, { ...csp, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'refresh_token required' }));
      return true;
    }
    res.writeHead(200, {
      ...csp,
      'Content-Type': 'application/json',
      'Set-Cookie': buildRefreshCookie(cookieName, body.refresh_token, { secure: isSecure }),
    });
    res.end(
      JSON.stringify({
        access_token: body.access_token,
        expires_at: body.expires_at,
        token_type: body.token_type ?? 'bearer',
      }),
    );
    return true;
  }

  if (method === 'POST' && pathname === '/refresh') {
    const refreshToken = getCookieValue(req.headers.cookie, cookieName);
    const csp = cspHeadersForConfig(shelluiConfig);
    if (!refreshToken) {
      res.writeHead(401, { ...csp, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing refresh cookie' }));
      return true;
    }
    let result;
    if (backend.type === 'supabase') {
      result = await proxySupabaseRefresh(backendUrl, backend.publishableKey, refreshToken);
    } else {
      result = await proxyShelluiRefresh(backendUrl, refreshToken);
    }
    if (!result.ok) {
      res.writeHead(result.status, { ...csp, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'refresh failed' }));
      return true;
    }
    const nextRefresh =
      typeof result.payload?.refresh_token === 'string'
        ? result.payload.refresh_token
        : refreshToken;
    res.writeHead(200, {
      ...csp,
      'Content-Type': 'application/json',
      'Set-Cookie': buildRefreshCookie(cookieName, nextRefresh, { secure: isSecure }),
    });
    res.end(JSON.stringify(publicTokenPayload(result.payload) ?? {}));
    return true;
  }

  if (method === 'POST' && pathname === '/logout') {
    res.writeHead(204, {
      ...cspHeadersForConfig(shelluiConfig),
      'Set-Cookie': clearRefreshCookie(cookieName, { secure: isSecure }),
    });
    res.end();
    return true;
  }

  return false;
}
