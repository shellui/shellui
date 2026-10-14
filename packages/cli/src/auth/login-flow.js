import crypto from 'crypto';
import http from 'http';
import { spawn } from 'child_process';
import pc from 'picocolors';

const LOGIN_TIMEOUT_MS = 3 * 60 * 1000;

/** HttpOnly cookie set when the callback document is served. Not written into HTML. */
export const LOGIN_NONCE_COOKIE = 'shellui_login_nonce';

/**
 * @returns {string}
 */
export function generateLoginNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * PKCE S256. Parameter names match the desktop and web flows.
 * @returns {{ verifier: string, challenge: string }}
 */
export function createLoginPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * @param {string | string[] | undefined} header
 * @param {string} name
 * @returns {string | null}
 */
export function readRequestCookie(header, name) {
  const raw = Array.isArray(header) ? header.join(';') : header;
  if (typeof raw !== 'string' || !raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/**
 * @param {string | undefined} left
 * @param {string} right
 */
function nonceMatches(left, right) {
  if (typeof left !== 'string' || !left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * @param {{
 *   port: number,
 *   host: string | undefined,
 *   origin: string | undefined,
 *   cookie: string | null,
 *   expectedNonce: string,
 *   callbackServed: boolean,
 *   used: boolean,
 * }} input
 * @returns {'ok' | 'forbidden' | 'used'}
 */
export function evaluateLoopbackCapture(input) {
  if (input.used) return 'used';
  if (!input.callbackServed) return 'forbidden';
  const expectedHost = `127.0.0.1:${input.port}`;
  const expectedOrigin = `http://127.0.0.1:${input.port}`;
  const host = typeof input.host === 'string' ? input.host.trim().toLowerCase() : '';
  const origin = typeof input.origin === 'string' ? input.origin.trim() : '';
  if (host !== expectedHost || origin !== expectedOrigin) return 'forbidden';
  if (!nonceMatches(input.cookie, input.expectedNonce)) return 'forbidden';
  return 'ok';
}

/**
 * @param {unknown} payload
 * @param {string} expectedNonce
 */
export function validateCaptureNonce(payload, expectedNonce) {
  if (!payload || typeof payload !== 'object') return false;
  const nonce = /** @type {Record<string, unknown>} */ (payload).nonce;
  return typeof nonce === 'string' && nonce.length > 0 && nonce === expectedNonce;
}

/**
 * @param {string} url
 */
export function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    return;
  }
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    return;
  }
  spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

/**
 * @param {{ port: number, backendUrl: string }} ctx
 */
export function buildWaitingPageHtml({ port, backendUrl }) {
  const authorizePrefix = `${backendUrl.replace(/\/$/, '')}/api/v1/authorize`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>shellui login</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0f1419; color: #e7ecf3; }
    main { width: min(28rem, calc(100% - 2rem)); padding: 2rem;
      border: 1px solid #2a3441; border-radius: 12px; background: #151b23; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; }
    p { margin: 0 0 0.75rem; color: #9aa7b8; font-size: 0.95rem; line-height: 1.45; }
    code { font-size: 0.85rem; color: #c5d0de; word-break: break-all; }
    .warn { color: #f0b429; margin-top: 1rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <main>
    <h1>shellui CLI sign-in</h1>
    <p>Waiting for sign-in in your browser…</p>
    <p>Session port: <code>${port}</code></p>
    <p class="warn">Only continue if you ran <code>shellui login</code> in your terminal and the authorize URL starts with <code>${authorizePrefix}</code>.</p>
  </main>
</body>
</html>`;
}

/**
 * @param {{ backendUrl: string, codeVerifier: string }} ctx
 */
export function buildCallbackPageHtml({ backendUrl, codeVerifier }) {
  const backendJson = JSON.stringify(backendUrl.replace(/\/$/, ''));
  const verifierJson = JSON.stringify(codeVerifier);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>shellui login</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0f1419; color: #e7ecf3; }
    main { width: min(28rem, calc(100% - 2rem)); padding: 2rem;
      border: 1px solid #2a3441; border-radius: 12px; background: #151b23; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; }
    p { margin: 0 0 0.75rem; color: #9aa7b8; font-size: 0.95rem; line-height: 1.45; }
    code { font-size: 0.85rem; color: #c5d0de; word-break: break-all; }
    .warn { color: #f0b429; margin-top: 1rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Completing sign-in…</h1>
    <p id="msg">Please wait.</p>
  </main>
  <script>
    (async function () {
      var codeVerifier = ${verifierJson};
      var title = document.getElementById('title');
      var msg = document.getElementById('msg');
      var params = new URLSearchParams(window.location.search);
      var backend = ${backendJson};
      var err = params.get('shellui_oauth_error');
      var errCode = params.get('shellui_oauth_error_code');
      if (err) {
        title.textContent = 'Sign-in failed';
        msg.textContent = err + (errCode ? ' (' + errCode + ')' : '');
        try {
          await fetch('/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err, errorCode: errCode || null }),
          });
        } catch (e) {}
        return;
      }
      var authCode = params.get('shellui_auth_code');
      var access_token;
      var refresh_token;
      var expires_at;
      var token_type = 'bearer';
      if (authCode) {
        var redirect_to = window.location.origin + window.location.pathname;
        try {
          var sessionRes = await fetch(backend + '/api/v1/oauth/session', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auth_code: authCode,
              redirect_to: redirect_to,
              code_verifier: codeVerifier,
            }),
          });
          var sessionPayload = await sessionRes.json().catch(function () { return null; });
          if (!sessionRes.ok) {
            var sessionErr =
              (sessionPayload && (sessionPayload.error || sessionPayload.detail)) ||
              ('Session exchange failed (HTTP ' + sessionRes.status + ').');
            throw new Error(String(sessionErr));
          }
          access_token = sessionPayload && sessionPayload.access_token;
          refresh_token = sessionPayload && sessionPayload.refresh_token;
          expires_at = sessionPayload && sessionPayload.expires_at;
          token_type =
            (sessionPayload && sessionPayload.token_type) || 'bearer';
        } catch (exchangeErr) {
          title.textContent = 'Sign-in failed';
          msg.textContent =
            (exchangeErr && exchangeErr.message) ||
            'Could not exchange auth code. Close this window and try again.';
          try {
            await fetch('/error', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                error: (exchangeErr && exchangeErr.message) || 'Session exchange failed.',
              }),
            });
          } catch (e) {}
          return;
        }
      } else {
        var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        access_token = hash.get('access_token');
        refresh_token = hash.get('refresh_token');
        expires_at = hash.get('expires_at');
        token_type = hash.get('token_type') || 'bearer';
      }
      if (!access_token || !refresh_token) {
        title.textContent = 'Sign-in failed';
        msg.textContent = 'Missing tokens in callback. Close this window and try again.';
        try {
          await fetch('/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing tokens in callback.' }),
          });
        } catch (e) {}
        return;
      }
      try {
        var res = await fetch('/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: expires_at,
            token_type: token_type,
          }),
        });
        if (!res.ok) throw new Error('CLI rejected tokens');
        title.textContent = 'Signed in';
        msg.textContent = 'Credentials were sent to the shellui CLI on this machine. You can close this window.';
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {
        title.textContent = 'Sign-in failed';
        msg.textContent = 'Could not send tokens to the CLI. Close this window and try again.';
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * @param {string} backendUrl
 * @param {string} companyId
 * @returns {Promise<string[]>}
 */
export async function fetchOAuthProviders(backendUrl, companyId) {
  const url = new URL('/api/v1/settings', backendUrl.replace(/\/$/, ''));
  url.searchParams.set('company_id', companyId);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Could not load auth settings (${res.status}).`);
  }
  const body = await res.json().catch(() => null);
  /** @type {string[]} */
  const providers = [];
  if (body && typeof body === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (body);
    const list = obj.oauthProviders;
    if (Array.isArray(list)) {
      for (const p of list) {
        if (typeof p === 'string' && p.trim()) providers.push(p.trim().toLowerCase());
      }
    }
    const external = obj.external;
    if (external && typeof external === 'object' && !Array.isArray(external)) {
      for (const [key, enabled] of Object.entries(
        /** @type {Record<string, unknown>} */ (external),
      )) {
        if (enabled && typeof key === 'string' && key.trim()) {
          providers.push(key.trim().toLowerCase());
        }
      }
    }
  }
  return [...new Set(providers)];
}

/**
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   provider?: string,
 *   redirectTo: string,
 *   state?: string,
 *   codeChallenge?: string,
 * }} opts
 */
export function buildAuthorizeUrl(opts) {
  const url = new URL('/api/v1/authorize', opts.backendUrl.replace(/\/$/, ''));
  const provider = typeof opts.provider === 'string' ? opts.provider.trim().toLowerCase() : '';
  if (provider) {
    url.searchParams.set('provider', provider);
  }
  url.searchParams.set('company_id', opts.companyId);
  url.searchParams.set('redirect_to', opts.redirectTo);
  if (typeof opts.state === 'string' && opts.state) {
    url.searchParams.set('state', opts.state);
  }
  if (typeof opts.codeChallenge === 'string' && opts.codeChallenge) {
    url.searchParams.set('code_challenge', opts.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

/**
 * Browser OAuth via identity authorize → loopback session-code or fragment bounce.
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   provider?: string,
 *   openBrowser?: boolean,
 *   onReady?: (info: { port: number }) => void,
 * }} opts
 * @returns {Promise<{
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: number | null,
 *   tokenType: string,
 * }>}
 */
export async function runLoginFlow(opts) {
  const { backendUrl, companyId } = opts;
  const provider = typeof opts.provider === 'string' ? opts.provider.trim().toLowerCase() : '';
  const loginNonce = generateLoginNonce();
  const pkce = createLoginPkcePair();

  return new Promise((resolve, reject) => {
    /** @type {import('http').Server | null} */
    let server = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;
    let settled = false;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (server) {
        server.close();
        server = null;
      }
      if (err) reject(err);
      else resolve(result);
    };

    let callbackServed = false;
    let captureUsed = false;

    const rejectCapture = (res, status) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: status === 409 ? 'used' : 'forbidden' }));
    };

    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const address = server?.address();
      const port = address && typeof address !== 'string' ? address.port : 0;

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildWaitingPageHtml({ port, backendUrl }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/callback') {
        callbackServed = true;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `${LOGIN_NONCE_COOKIE}=${encodeURIComponent(loginNonce)}; HttpOnly; SameSite=Strict; Path=/`,
          'Cache-Control': 'no-store',
        });
        res.end(buildCallbackPageHtml({ backendUrl, codeVerifier: pkce.verifier }));
        return;
      }

      if (req.method === 'POST' && (url.pathname === '/capture' || url.pathname === '/error')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          const hostHeader = req.headers.host;
          const originHeader = req.headers.origin;
          const decision = evaluateLoopbackCapture({
            port,
            host: typeof hostHeader === 'string' ? hostHeader : undefined,
            origin: typeof originHeader === 'string' ? originHeader : undefined,
            cookie: readRequestCookie(req.headers.cookie, LOGIN_NONCE_COOKIE),
            expectedNonce: loginNonce,
            callbackServed,
            used: captureUsed,
          });
          if (decision !== 'ok') {
            rejectCapture(res, decision === 'used' ? 409 : 403);
            return;
          }

          let payload;
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            return;
          }

          captureUsed = true;

          if (url.pathname === '/error') {
            const message =
              (typeof payload.error === 'string' && payload.error) || 'OAuth sign-in failed.';
            const code =
              typeof payload.errorCode === 'string' && payload.errorCode
                ? ` (${payload.errorCode})`
                : '';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            finish(new Error(`${message}${code}`));
            return;
          }
          if (
            typeof payload.access_token !== 'string' ||
            !payload.access_token ||
            typeof payload.refresh_token !== 'string' ||
            !payload.refresh_token
          ) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            finish(new Error('Callback did not include access and refresh tokens.'));
            return;
          }
          const expiresAtRaw = payload.expires_at;
          const expiresAt =
            typeof expiresAtRaw === 'number'
              ? expiresAtRaw
              : typeof expiresAtRaw === 'string' && expiresAtRaw
                ? Number(expiresAtRaw)
                : null;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          finish(null, {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: Number.isFinite(expiresAt) ? /** @type {number} */ (expiresAt) : null,
            tokenType:
              typeof payload.token_type === 'string' && payload.token_type
                ? payload.token_type
                : 'bearer',
          });
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    server.on('error', (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server?.address();
      if (!address || typeof address === 'string') {
        finish(new Error('Failed to bind loopback login server.'));
        return;
      }
      const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
      const authorizeUrl = buildAuthorizeUrl({
        backendUrl,
        companyId,
        ...(provider ? { provider } : {}),
        redirectTo: callbackUrl,
        codeChallenge: pkce.challenge,
      });
      const authorizePrefix = `${backendUrl.replace(/\/$/, '')}/api/v1/authorize`;

      console.log(pc.cyan('Sign in via your browser (loopback only):'));
      console.log(pc.dim(`  Loopback port: ${address.port}`));
      console.log(pc.dim(`  Authorize URLs must start with: ${authorizePrefix}`));
      console.log('');
      console.log(pc.bold(authorizeUrl));
      console.log('');
      console.log(
        pc.yellow(
          'Only sign in if you started `shellui login` in this terminal. Ignore authorize links from other sources.',
        ),
      );
      console.log(pc.dim('Waiting for authentication…'));
      if (typeof opts.onReady === 'function') {
        opts.onReady({ port: address.port });
      }
      if (opts.openBrowser !== false) {
        try {
          openBrowser(authorizeUrl);
        } catch {
          // User can open the URL manually
        }
      }
      timer = setTimeout(() => {
        finish(new Error('Login timed out. Run shellui login again.'));
      }, LOGIN_TIMEOUT_MS);
    });
  });
}
