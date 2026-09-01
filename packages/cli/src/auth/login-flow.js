import http from 'http';
import { spawn } from 'child_process';
import pc from 'picocolors';

const LOGIN_TIMEOUT_MS = 3 * 60 * 1000;

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

function waitingPageHtml() {
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
    main { width: min(24rem, calc(100% - 2rem)); padding: 2rem;
      border: 1px solid #2a3441; border-radius: 12px; background: #151b23; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; }
    p { margin: 0; color: #9aa7b8; font-size: 0.95rem; line-height: 1.4; }
  </style>
</head>
<body>
  <main>
    <h1>shellui</h1>
    <p>Waiting for sign-in in your browser…</p>
  </main>
</body>
</html>`;
}

function callbackPageHtml() {
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
    main { width: min(24rem, calc(100% - 2rem)); padding: 2rem;
      border: 1px solid #2a3441; border-radius: 12px; background: #151b23; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; }
    p { margin: 0; color: #9aa7b8; font-size: 0.95rem; line-height: 1.4; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Completing sign-in…</h1>
    <p id="msg">Please wait.</p>
  </main>
  <script>
    (async function () {
      var title = document.getElementById('title');
      var msg = document.getElementById('msg');
      var params = new URLSearchParams(window.location.search);
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
      var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      var access_token = hash.get('access_token');
      var refresh_token = hash.get('refresh_token');
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
      var expires_at = hash.get('expires_at');
      var token_type = hash.get('token_type') || 'bearer';
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
        msg.textContent = 'You can close this window and return to the terminal.';
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
  return url.toString();
}

/**
 * Browser OAuth via identity authorize → loopback fragment bounce.
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   provider?: string,
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

    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(waitingPageHtml());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/callback') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackPageHtml());
        return;
      }

      if (req.method === 'POST' && (url.pathname === '/capture' || url.pathname === '/error')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          let payload;
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            finish(new Error('Invalid callback payload from browser.'));
            return;
          }
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
      });

      console.log(pc.cyan('Open this URL in your browser to sign in:'));
      console.log(pc.bold(authorizeUrl));
      console.log(pc.dim('Waiting for authentication…'));
      try {
        openBrowser(authorizeUrl);
      } catch {
        // User can open the URL manually
      }
      timer = setTimeout(() => {
        finish(new Error('Login timed out. Run shellui login again.'));
      }, LOGIN_TIMEOUT_MS);
    });
  });
}
