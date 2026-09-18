import type { AuthSession } from '../types';
import { buildSessionFromParams } from './buildSessionFromParams';

const BFF_SESSION_PATH = '/api/auth/session';
const BFF_REFRESH_PATH = '/api/auth/refresh';
const BFF_LOGOUT_PATH = '/api/auth/logout';

type BffTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | string;
  expires_in?: number | string;
  token_type?: string;
};

const parseBffTokenResponse = (
  payload: BffTokenResponse,
  current: AuthSession,
  nowSeconds: number,
): AuthSession | null => {
  const params = new URLSearchParams();
  if (typeof payload.access_token === 'string') {
    params.set('access_token', payload.access_token);
  }
  if (typeof payload.refresh_token === 'string') {
    params.set('refresh_token', payload.refresh_token);
  } else if (current.refreshToken) {
    params.set('refresh_token', current.refreshToken);
  }
  if (typeof payload.expires_at === 'number' || typeof payload.expires_at === 'string') {
    params.set('expires_at', String(payload.expires_at));
  }
  if (typeof payload.expires_in === 'number' || typeof payload.expires_in === 'string') {
    params.set('expires_in', String(payload.expires_in));
  }
  if (typeof payload.token_type === 'string') {
    params.set('token_type', payload.token_type);
  }
  const built = buildSessionFromParams(params, nowSeconds);
  if (!built) return null;
  return {
    ...built,
    provider: built.provider ?? current.provider,
    userPreferences: current.userPreferences ?? built.userPreferences,
  };
};

/** Hand refresh token to BFF; HttpOnly cookie is set server-side. Returns session without refresh in memory. */
export const establishBffAuthSession = async (
  session: AuthSession,
  nowSeconds: number,
): Promise<AuthSession | null> => {
  const response = await fetch(BFF_SESSION_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: session.refreshToken,
      access_token: session.accessToken,
      expires_at: session.expiresAt,
      token_type: session.tokenType,
    }),
  });
  if (!response.ok) {
    throw new Error(`BFF session failed (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as BffTokenResponse;
  const next = parseBffTokenResponse(payload, session, nowSeconds);
  if (!next) return null;
  return { ...next, refreshToken: '' };
};

/** Refresh access token via same-origin BFF (HttpOnly refresh cookie). */
export const refreshBffAuthSession = async (
  current: AuthSession,
  nowSeconds: number,
): Promise<AuthSession | null> => {
  const response = await fetch(BFF_REFRESH_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as BffTokenResponse;
  const next = parseBffTokenResponse(payload, current, nowSeconds);
  if (!next) return null;
  return { ...next, refreshToken: '' };
};

/** Clear BFF HttpOnly cookie and optionally notify identity logout. */
export const logoutBffAuthSession = async (accessToken: string | null | undefined) => {
  await fetch(BFF_LOGOUT_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  }).catch(() => {
    // Best-effort; local session is cleared regardless.
  });
};
