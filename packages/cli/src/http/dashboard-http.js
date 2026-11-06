import { loadValidSession, refreshSession } from '../auth/session.js';

/**
 * Fetch against the SaaS dashboard host with the same Bearer session as identity login.
 * Does not add `company_id` query (dashboard resources use global company UUIDs in paths).
 *
 * @param {string} saasBaseUrl
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 */
export async function dashboardServiceFetch(saasBaseUrl, path, init = {}) {
  const session = await loadValidSession();
  if (!session) {
    throw new Error('Not logged in. Run shellui login first.');
  }
  return serviceFetchWithSessionNoCompanyQuery(session, saasBaseUrl, path, init);
}

/**
 * @param {{ accessToken: string, refreshToken?: string, backendUrl: string, companyId: string }} session
 * @param {string} baseUrl
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 */
async function serviceFetchWithSessionNoCompanyQuery(session, baseUrl, path, init = {}) {
  const base = baseUrl.replace(/\/$/, '');
  const url = new URL(
    path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`,
  );

  const doFetch = (accessToken) =>
    fetch(url.toString(), {
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

  let active = session;
  let response = await doFetch(active.accessToken);
  if (response.status === 401 && active.refreshToken) {
    active = await refreshSession(active);
    response = await doFetch(active.accessToken);
  }
  return { response, session: active };
}
