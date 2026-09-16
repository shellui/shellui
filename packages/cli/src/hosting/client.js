import { loadValidSession, refreshSession } from '../auth/session.js';

/**
 * Authenticated fetch helper against hosting-service (uses identity session tokens).
 * @param {string} hostingUrl - Base URL of hosting-service (no trailing slash)
 * @param {string} path - Path under hosting (e.g. `/hosting/v1/apps`)
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 */
export async function hostingFetch(hostingUrl, path, init = {}) {
  let session = await loadValidSession();
  if (!session) {
    throw new Error('Not logged in. Run shellui login first.');
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
 * @param {Response} response
 * @returns {Promise<string>}
 */
export async function readHostingError(response) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  return `HTTP ${response.status}`;
}
