import { loadValidSession, refreshSession } from '../auth/session.js';

export const DEPLOY_TOKEN_ENV = 'SHELLUI_DEPLOY_TOKEN';

/** Deploy token from the environment (CI), or null. Never print the value. */
export function deployTokenFromEnv() {
  const raw = process.env[DEPLOY_TOKEN_ENV];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * Replace any deploy token in text with a placeholder.
 * @param {string} text
 */
export function redactDeployToken(text) {
  let out = String(text).replace(/shellui_dt_[A-Za-z0-9_-]+/g, 'shellui_dt_***');
  const token = deployTokenFromEnv();
  if (token) out = out.split(token).join('***');
  return out;
}

/** Friendlier messages for hosting error codes a deploy token can hit. */
const ERROR_HINTS = {
  deploy_token_invalid: `${DEPLOY_TOKEN_ENV} is not a valid deploy token. Check the CI secret, or create a new token in admin (Hosting, Deploy tokens).`,
  deploy_token_revoked: `${DEPLOY_TOKEN_ENV} was revoked. Create a new token in admin and update the CI secret.`,
  deploy_token_expired: `${DEPLOY_TOKEN_ENV} has expired. Create a new token in admin and update the CI secret.`,
  deploy_token_preview_only:
    'Deploy tokens only deploy preview sites. hosting.slug names an app created in admin: use a preview slug, or remove hosting.slug to create a new preview.',
};

/**
 * Authenticated fetch helper against hosting-service (uses identity session tokens).
 * @param {string} hostingUrl - Base URL of hosting-service (no trailing slash)
 * @param {string} path - Path under hosting (e.g. `/hosting/v1/apps`)
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 */
export async function hostingFetch(hostingUrl, path, init = {}) {
  const deployToken = deployTokenFromEnv();
  let session = deployToken ? null : await loadValidSession();
  if (!deployToken && !session) {
    throw new Error(`Not logged in. Run shellui login first, or set ${DEPLOY_TOKEN_ENV} for CI.`);
  }

  const base = hostingUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const doFetch = (accessToken) =>
    fetch(url, {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body != null &&
        !(init.body instanceof Uint8Array) &&
        !(init.body instanceof ArrayBuffer)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(init.headers || {}),
      },
      body:
        init.body == null
          ? undefined
          : init.body instanceof Uint8Array || init.body instanceof ArrayBuffer
            ? init.body
            : JSON.stringify(init.body),
    });

  if (deployToken) {
    // CI: no interactive login and no refresh. The token is only sent as a header.
    return { response: await doFetch(deployToken), session: null };
  }
  let response = await doFetch(session.accessToken);
  if (response.status === 401 && session.refreshToken) {
    session = await refreshSession(session);
    response = await doFetch(session.accessToken);
  }
  return { response, session };
}

/**
 * Upload a binary artifact to hosting-service.
 * @param {string} hostingUrl
 * @param {string} path
 * @param {Uint8Array | Buffer} body
 */
export async function hostingUpload(hostingUrl, path, body) {
  return hostingFetch(hostingUrl, path, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/gzip' },
  });
}

/**
 * Human-readable cause from a hosting error response. Never contains a deploy token.
 * @param {Response} response
 * @param {{ artifactSize?: number }} [options]
 * @returns {Promise<string>}
 */
export async function readHostingError(response, { artifactSize } = {}) {
  const { payload, text } = await readBody(response);
  const code = payload && typeof payload.error === 'string' ? payload.error : '';
  if (ERROR_HINTS[code]) return ERROR_HINTS[code];
  let message = '';
  for (const key of ['detail', 'message', 'error']) {
    if (payload && typeof payload[key] === 'string' && payload[key].trim()) {
      message = payload[key].trim();
      break;
    }
  }
  if (!message && text)
    message = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
  if (!message && response.status === 401 && deployTokenFromEnv())
    return ERROR_HINTS.deploy_token_invalid;
  if (!message) message = `HTTP ${response.status}`;
  const tooLarge =
    response.status === 413 || code === 'upload_too_large' || /too ?(big|large)/i.test(message);
  if (artifactSize && tooLarge && !/ MB/.test(message)) {
    const limit =
      payload && Number(payload.limit_bytes) > 0
        ? `, the limit is ${toMb(payload.limit_bytes)} MB`
        : '';
    message = `${message} (artifact is ${toMb(artifactSize)} MB${limit})`;
  }
  return redactDeployToken(message);
}

function toMb(bytes) {
  return String(Math.round((Number(bytes) / 1024 ** 2) * 10) / 10);
}

async function readBody(response) {
  if (typeof response.text === 'function') {
    const text = await response.text().catch(() => '');
    try {
      return { payload: JSON.parse(text), text };
    } catch {
      return { payload: null, text };
    }
  }
  const payload = await response.json?.().catch(() => null);
  return { payload: payload && typeof payload === 'object' ? payload : null, text: '' };
}
