import { loadValidSession, refreshSession } from '../auth/session.js';

/**
 * Redact strings that look like bearer tokens or JWT fragments from debug text.
 * @param {string} text
 */
export function redactSensitive(text) {
  let out = String(text);
  out = out.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '***');
  out = out.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer ***');
  return out;
}

/**
 * @param {Response} response
 */
export async function readJsonErrorBody(response) {
  const text = await response.text().catch(() => '');
  let message = '';
  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === 'object') {
      for (const key of ['detail', 'message', 'error', 'error_description']) {
        const v = /** @type {Record<string, unknown>} */ (payload)[key];
        if (typeof v === 'string' && v.trim()) {
          message = v.trim();
          break;
        }
      }
    }
  } catch {
    // ignore
  }
  if (!message && text) {
    message = text.replace(/\s+/g, ' ').trim().slice(0, 280);
  }
  if (!message) message = `HTTP ${response.status}`;
  return message;
}

/**
 * Human-facing message for HTTP status (no secrets).
 * @param {number} status
 * @param {string} message
 */
export function formatHttpFailure(status, message) {
  const safe = redactSensitive(message);
  if (status === 401) {
    return `Not signed in or session expired (HTTP 401). Run shellui login again. ${safe}`;
  }
  if (status === 403) {
    return `Forbidden for this company or role (HTTP 403). ${safe}`;
  }
  return safe;
}

/**
 * @param {{ accessToken: string, refreshToken?: string, backendUrl: string, companyId: string }} session
 * @param {string} baseUrl
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 * @param {{ companyId?: string | null, omitCompanyQuery?: boolean }} [query]
 */
export async function serviceFetchWithSession(session, baseUrl, path, init = {}, query = {}) {
  const base = baseUrl.replace(/\/$/, '');
  const url = new URL(
    path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`,
  );
  if (!query.omitCompanyQuery && query.companyId != null && String(query.companyId).trim()) {
    url.searchParams.set('company_id', String(query.companyId).trim());
  }

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

/**
 * Loads session and calls a regional service (storage, hosting, saas) with optional company_id query.
 * @param {string} baseUrl
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [init]
 * @param {{ companyId?: string | null, omitCompanyQuery?: boolean }} [query]
 */
export async function regionalServiceFetch(baseUrl, path, init = {}, query = {}) {
  const session = await loadValidSession();
  if (!session) {
    throw new Error('Not logged in. Run shellui login first.');
  }
  return serviceFetchWithSession(session, baseUrl, path, init, query);
}
