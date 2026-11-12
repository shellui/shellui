/**
 * Same-origin BFF routes for the shell-host refresh cookie.
 *
 * The page posts a one-time `shellui_auth_code` here. This host exchanges it
 * with identity, stores the refresh token in an HttpOnly `shellui_refresh`
 * cookie, and returns only the access token, expiry, and user. The refresh
 * token is not in the JSON body.
 *
 * Routes:
 * - GET  /api/auth/session  — `{ "ready": true }` when these routes are mounted
 * - POST /api/auth/session  — exchange `auth_code` (not a refresh token from the page)
 * - POST /api/auth/refresh  — rotate the access token from the cookie
 * - POST /api/auth/logout   — revoke the session and clear the cookie
 *
 * `shellui start` and `serve:dist` mount these unless `security.bffAuth.enabled`
 * is false. A static host without the routes does not.
 */

import http from 'http';
import https from 'https';
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

/**
 * Identity base URL the BFF calls.
 * `SHELLUI_BFF_BACKEND_URL` overrides `backend.url` so the dev container can
 * reach identity on the Compose network while the browser keeps localhost.
 * @param {string | undefined} backendUrl
 * @returns {string}
 */
export function resolveBffUpstreamUrl(backendUrl) {
  const override =
    typeof process.env.SHELLUI_BFF_BACKEND_URL === 'string'
      ? process.env.SHELLUI_BFF_BACKEND_URL.trim()
      : '';
  const raw = override || backendUrl || '';
  return raw.replace(/\/+$/, '');
}

/**
 * Whether the refresh cookie should set Secure.
 * http://localhost does not, including when NODE_ENV is production.
 * `SHELLUI_BFF_SECURE_COOKIE=1` forces it on, `=0` forces it off.
 * @param {import('http').IncomingMessage | { headers?: import('http').IncomingHttpHeaders, socket?: { encrypted?: boolean } }} req
 * @returns {boolean}
 */
export function devBffCookieSecure(req) {
  const flag = process.env.SHELLUI_BFF_SECURE_COOKIE;
  if (flag === '1') return true;
  if (flag === '0') return false;
  const forwarded = req?.headers?.['x-forwarded-proto'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const proto = typeof raw === 'string' ? raw.split(',')[0].trim().toLowerCase() : '';
  if (proto === 'https') return true;
  if (proto === 'http') return false;
  return Boolean(req?.socket?.encrypted);
}

/**
 * Host routes are on for `shellui start` and `serve:dist` unless the config
 * sets `security.bffAuth.enabled` to false, and a backend URL is required.
 * @param {object | null | undefined} shelluiConfig
 * @returns {boolean}
 */
export function isBffHostEnabled(shelluiConfig) {
  if (shelluiConfig?.security?.bffAuth?.enabled === false) return false;
  const url = shelluiConfig?.backend?.url;
  return typeof url === 'string' && url.trim().length > 0;
}

export function buildRefreshCookie(name, refreshToken, { secure }) {
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

/**
 * @param {import('http').IncomingHttpHeaders | Record<string, string | string[] | undefined>} headers
 * @param {string} name
 * @returns {string}
 */
function headerValue(headers, name) {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * `http(s)` origin of `redirect_to`. Identity requires `Origin` to equal this
 * on `POST /api/v1/oauth/session`. Custom schemes (desktop) have no browser
 * origin; identity skips that check, so this returns null and the host omits
 * `Origin`. `invalid` is true when `redirect_to` is not a URL.
 * @param {string} redirectTo
 * @returns {{ invalid: true } | { invalid: false, origin: string | null }}
 */
export function originOfRedirectTo(redirectTo) {
  let url;
  try {
    url = new URL(redirectTo);
  } catch {
    return { invalid: true };
  }
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    return { invalid: false, origin: url.origin };
  }
  return { invalid: false, origin: null };
}

/**
 * Public origin from the browser request. The session exchange does not use
 * this. Identity wants the origin of `redirect_to`.
 * @param {import('http').IncomingHttpHeaders | Record<string, string | string[] | undefined>} headers
 * @returns {string | null}
 */
export function resolveShellOrigin(headers) {
  const originHeader = headerValue(headers, 'origin');
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Fall through to Host.
    }
  }
  const host = headerValue(headers, 'x-forwarded-host') || headerValue(headers, 'host');
  if (!host) return null;
  const forwarded = headerValue(headers, 'x-forwarded-proto').split(',')[0].trim().toLowerCase();
  const scheme = forwarded === 'https' || forwarded === 'http' ? forwarded : 'http';
  const hostOnly = host.split(',')[0].trim();
  try {
    return new URL(`${scheme}://${hostOnly}`).origin;
  } catch {
    return null;
  }
}

/**
 * POST JSON with an explicit Origin. Node fetch strips Origin, so this uses
 * `http.request` / `https.request`.
 * @param {string} urlString
 * @param {{ headers?: Record<string, string>, body?: unknown }} options
 */
export function postIdentityJson(urlString, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      reject(error);
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error('Identity URL must be http(s).'));
      return;
    }
    const payload = body == null ? '' : JSON.stringify(body);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = null;
            }
          }
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            payload: parsed && typeof parsed === 'object' ? parsed : null,
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20_000, () => {
      req.destroy(new Error('Identity request timed out'));
    });
    req.end(payload);
  });
}

/** Tests replace `postJson` to avoid a live identity. Runtime uses `postIdentityJson`. */
export const identityHttp = {
  postJson: postIdentityJson,
};

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

function jsonResult(status, body, extraHeaders = {}) {
  return {
    handled: true,
    status,
    headers: { ...jsonHeaders(), ...extraHeaders },
    body: JSON.stringify(body),
  };
}

/**
 * User claims from the access token. The refresh token is never included.
 * @param {string} token
 * @returns {{ id: string | null, email: string | null, name: string | null } | null}
 */
function userFromAccessToken(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    const meta =
      json.user_metadata && typeof json.user_metadata === 'object' ? json.user_metadata : {};
    const name =
      typeof meta.name === 'string'
        ? meta.name
        : typeof meta.full_name === 'string'
          ? meta.full_name
          : null;
    const user = {
      id:
        typeof json.sub === 'string'
          ? json.sub
          : typeof json.user_id === 'string'
            ? json.user_id
            : null,
      email: typeof json.email === 'string' ? json.email : null,
      name,
    };
    if (!user.id && !user.email && !user.name) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Access token, expiry, and user. `refresh_token` is dropped on purpose.
 * @param {Record<string, unknown> | null | undefined} payload
 */
export function publicSessionPayload(payload) {
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
  if (typeof payload.access_token === 'string') {
    const user = userFromAccessToken(payload.access_token);
    if (user) out.user = user;
  }
  return out;
}

function publicErrorPayload(payload, status) {
  const err = payload?.error ?? payload?.detail;
  const message = typeof err === 'string' && err.trim() ? err : `HTTP ${status}`;
  const out = { error: message };
  if (typeof payload?.error_code === 'string' && payload.error_code.trim()) {
    out.error_code = payload.error_code.trim();
  }
  return out;
}

function identityFailure(result) {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502;
  return jsonResult(status, publicErrorPayload(result.payload, status));
}

/**
 * @param {object} args
 * @param {string} args.method
 * @param {string} args.pathname Path under `/api/auth`, such as `/session`.
 * @param {import('http').IncomingHttpHeaders | Record<string, string | string[] | undefined>} [args.headers]
 * @param {Record<string, unknown> | null} [args.body]
 * @param {object} args.shelluiConfig
 * @param {boolean} args.secure
 */
export async function dispatchAuthBff({
  method,
  pathname,
  headers = {},
  body = {},
  shelluiConfig,
  secure,
}) {
  if (!isBffHostEnabled(shelluiConfig)) {
    return { handled: false };
  }

  const backend = shelluiConfig.backend;
  const cookieName = shelluiConfig?.security?.bffAuth?.cookieName || DEFAULT_COOKIE_NAME;
  const backendUrl = resolveBffUpstreamUrl(backend.url);
  if (!backendUrl) return { handled: false };

  if (method === 'GET' && pathname === '/session') {
    return jsonResult(200, { ready: true });
  }

  if (method === 'POST' && pathname === '/session') {
    const authCode = typeof body?.auth_code === 'string' ? body.auth_code.trim() : '';
    const redirectTo = typeof body?.redirect_to === 'string' ? body.redirect_to.trim() : '';
    if (!authCode) {
      return jsonResult(400, { error: 'auth_code required' });
    }
    if (!redirectTo) {
      return jsonResult(400, { error: 'redirect_to required' });
    }
    if (backend.type === 'supabase') {
      return jsonResult(400, {
        error: 'Host code exchange is for the Shellui identity backend.',
      });
    }
    const redirectOrigin = originOfRedirectTo(redirectTo);
    if (redirectOrigin.invalid) {
      return jsonResult(400, { error: 'redirect_to must be an absolute URL' });
    }
    const codeVerifier = typeof body.code_verifier === 'string' ? body.code_verifier : '';
    let result;
    try {
      // No Cookie header. Identity does not use a cookie on this call.
      // Origin is the origin of redirect_to, which is the shell origin.
      result = await identityHttp.postJson(`${backendUrl}/api/v1/oauth/session`, {
        headers: redirectOrigin.origin ? { Origin: redirectOrigin.origin } : {},
        body: {
          auth_code: authCode,
          redirect_to: redirectTo,
          code_verifier: codeVerifier,
        },
      });
    } catch {
      return jsonResult(502, { error: 'identity unavailable' });
    }
    const refreshToken =
      result.ok && typeof result.payload?.refresh_token === 'string'
        ? result.payload.refresh_token
        : '';
    if (!result.ok || !refreshToken) {
      return identityFailure(
        result.ok
          ? { status: 502, payload: { error: 'Identity did not return a session.' } }
          : result,
      );
    }
    const pub = publicSessionPayload(result.payload);
    if (!pub?.access_token) {
      return jsonResult(502, { error: 'Identity did not return an access token.' });
    }
    return jsonResult(200, pub, {
      'Set-Cookie': buildRefreshCookie(cookieName, refreshToken, { secure }),
    });
  }

  if (method === 'POST' && pathname === '/refresh') {
    const refreshToken = getCookieValue(headerValue(headers, 'cookie'), cookieName);
    if (!refreshToken) {
      return jsonResult(401, { error: 'missing refresh cookie' });
    }
    let result;
    try {
      if (backend.type === 'supabase') {
        if (!backend.publishableKey) {
          return jsonResult(500, { error: 'missing publishableKey' });
        }
        const refreshUrl = new URL(`${backendUrl}/auth/v1/token`);
        refreshUrl.searchParams.set('grant_type', 'refresh_token');
        result = await identityHttp.postJson(refreshUrl.toString(), {
          headers: {
            apikey: backend.publishableKey,
            Authorization: `Bearer ${backend.publishableKey}`,
          },
          body: { refresh_token: refreshToken },
        });
      } else {
        const refreshUrl = new URL(`${backendUrl}/api/v1/token`);
        refreshUrl.searchParams.set('grant_type', 'refresh_token');
        // Origin is not required. The body is only the refresh token from the cookie.
        result = await identityHttp.postJson(refreshUrl.toString(), {
          headers: {},
          body: { refresh_token: refreshToken },
        });
      }
    } catch {
      return jsonResult(502, { error: 'identity unavailable' });
    }
    if (!result.ok) return identityFailure(result);
    const nextRefresh =
      typeof result.payload?.refresh_token === 'string' && result.payload.refresh_token
        ? result.payload.refresh_token
        : refreshToken;
    const pub = publicSessionPayload(result.payload);
    if (!pub?.access_token) {
      return jsonResult(502, { error: 'Identity did not return an access token.' });
    }
    return jsonResult(200, pub, {
      'Set-Cookie': buildRefreshCookie(cookieName, nextRefresh, { secure }),
    });
  }

  if (method === 'POST' && pathname === '/logout') {
    const refreshToken = getCookieValue(headerValue(headers, 'cookie'), cookieName);
    const authorization = headerValue(headers, 'authorization');
    // Identity logout is the bearer access token plus the refresh token.
    // The page supplies the access token. The refresh token comes from the cookie.
    if (backend.type === 'shellui' && authorization && refreshToken) {
      try {
        await identityHttp.postJson(`${backendUrl}/api/v1/logout`, {
          headers: { Authorization: authorization },
          body: { refresh_token: refreshToken },
        });
      } catch {
        // The cookie is cleared either way.
      }
    }
    return {
      handled: true,
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': clearRefreshCookie(cookieName, { secure }),
      },
      body: '',
    };
  }

  return { handled: false };
}

function writeDispatchResult(res, result) {
  res.statusCode = result.status;
  const headers = result.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      appendSetCookie(res, value);
    } else {
      res.setHeader(key, value);
    }
  }
  res.end(result.body ?? '');
}

/**
 * @param {object} shelluiConfig
 */
export function authBffPlugin(shelluiConfig) {
  const backend = shelluiConfig?.backend;

  return {
    name: 'shellui-auth-bff',
    configureServer(server) {
      if (!isBffHostEnabled(shelluiConfig) || !backend?.url) {
        return;
      }

      server.middlewares.use('/api/auth', async (req, res, next) => {
        const pathname = (req.url ?? '/').split('?')[0] || '/';
        const method = req.method ?? 'GET';

        if (method === 'OPTIONS' && ['/session', '/refresh', '/logout'].includes(pathname)) {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (!['/session', '/refresh', '/logout'].includes(pathname)) {
          next();
          return;
        }

        try {
          let body = {};
          if (method === 'POST') {
            const raw = await readRequestBody(req);
            const parsed = parseJsonBody(raw);
            if (parsed === null) {
              writeDispatchResult(res, jsonResult(400, { error: 'invalid json' }));
              return;
            }
            body = parsed;
          }
          const result = await dispatchAuthBff({
            method,
            pathname,
            headers: req.headers,
            body,
            shelluiConfig,
            secure: devBffCookieSecure(req),
          });
          if (!result.handled) {
            next();
            return;
          }
          writeDispatchResult(res, result);
        } catch (error) {
          console.error('[shellui-auth-bff]', error);
          writeDispatchResult(res, jsonResult(500, { error: 'internal error' }));
        }
      });
    },
  };
}

function cspHeadersForConfig(shelluiConfig) {
  return resolveShellCspHeaders(shelluiConfig, { useScriptHash: true });
}

/**
 * Auth BFF handler for serve-dist.mjs (production preview).
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} shelluiConfig
 * @returns {Promise<boolean>} true when handled
 */
export async function handleAuthBffRequest(req, res, shelluiConfig) {
  if (!isBffHostEnabled(shelluiConfig)) return false;

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/auth')) return false;

  const pathname = url.pathname.slice('/api/auth'.length) || '/';
  const method = req.method ?? 'GET';
  const csp = cspHeadersForConfig(shelluiConfig);

  if (method === 'OPTIONS' && ['/session', '/refresh', '/logout'].includes(pathname)) {
    res.writeHead(204, csp);
    res.end();
    return true;
  }

  if (!['/session', '/refresh', '/logout'].includes(pathname)) return false;

  let body = {};
  if (method === 'POST') {
    const raw = await readRequestBody(req);
    const parsed = parseJsonBody(raw);
    if (parsed === null) {
      res.writeHead(400, { ...csp, ...jsonHeaders() });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return true;
    }
    body = parsed;
  }

  try {
    const result = await dispatchAuthBff({
      method,
      pathname,
      headers: req.headers,
      body,
      shelluiConfig,
      secure: devBffCookieSecure(req),
    });
    if (!result.handled) return false;
    res.writeHead(result.status, { ...csp, ...(result.headers ?? {}) });
    res.end(result.body ?? '');
    return true;
  } catch (error) {
    console.error('[shellui-auth-bff]', error);
    res.writeHead(500, { ...csp, ...jsonHeaders() });
    res.end(JSON.stringify({ error: 'internal error' }));
    return true;
  }
}
