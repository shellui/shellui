import { readCredentials, writeCredentials } from './credentials.js';

const EXPIRY_SKEW_SECONDS = 60;

/**
 * @param {{ expiresAt?: number | null }} session
 * @param {number} [nowSeconds]
 */
export function isAccessTokenExpired(session, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (session?.expiresAt == null || !Number.isFinite(session.expiresAt)) return false;
  return nowSeconds >= session.expiresAt - EXPIRY_SKEW_SECONDS;
}

/**
 * Refresh access token using stored refresh_token.
 * @param {{ backendUrl: string, refreshToken: string, companyId: string, tokenType?: string }} session
 */
export async function refreshSession(session) {
  const refreshUrl = new URL(`${session.backendUrl}/api/v1/token`);
  refreshUrl.searchParams.set('grant_type', 'refresh_token');
  const response = await fetch(refreshUrl.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed (HTTP ${response.status}). Run shellui login again.`);
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload.access_token !== 'string') {
    throw new Error('Token refresh returned an invalid payload. Run shellui login again.');
  }
  const next = {
    backendUrl: session.backendUrl,
    companyId: session.companyId,
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === 'string' && payload.refresh_token
        ? payload.refresh_token
        : session.refreshToken,
    expiresAt:
      typeof payload.expires_at === 'number'
        ? payload.expires_at
        : typeof payload.expires_at === 'string' && payload.expires_at
          ? Number(payload.expires_at)
          : null,
    tokenType:
      typeof payload.token_type === 'string' && payload.token_type
        ? payload.token_type
        : session.tokenType || 'bearer',
  };
  writeCredentials(next);
  return next;
}

/**
 * Load credentials and refresh if the access token is expired.
 */
export async function loadValidSession() {
  const session = readCredentials();
  if (!session) return null;
  if (!isAccessTokenExpired(session)) return session;
  try {
    return await refreshSession(session);
  } catch {
    return null;
  }
}

/**
 * Authenticated GET/POST helper against the identity backend.
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [init]
 */
export async function authFetch(path, init = {}) {
  let session = await loadValidSession();
  if (!session) {
    throw new Error('Not logged in. Run shellui login first.');
  }
  const url = new URL(path.startsWith('http') ? path : `${session.backendUrl}${path}`);
  if (!url.searchParams.has('company_id')) {
    url.searchParams.set('company_id', session.companyId);
  }
  const doFetch = (accessToken) =>
    fetch(url.toString(), {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
    });

  let response = await doFetch(session.accessToken);
  if (response.status === 401 && session.refreshToken) {
    session = await refreshSession(session);
    response = await doFetch(session.accessToken);
  }
  return { response, session };
}

/**
 * Best-effort remote logout (ignore network errors).
 * @param {{ backendUrl: string, accessToken: string }} session
 */
export async function remoteLogout(session) {
  try {
    await fetch(`${session.backendUrl}/api/v1/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
  } catch {
    // ignore
  }
}
