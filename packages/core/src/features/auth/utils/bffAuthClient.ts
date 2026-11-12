import type { AuthSession } from '../types';
import { AuthRequestError } from './authRequestError';
import { persistAuthSession } from './authSessionPersistence';
import { buildSessionFromTokenPayload } from './buildSessionFromTokenPayload';

const BFF_SESSION_PATH = '/api/auth/session';
const BFF_REFRESH_PATH = '/api/auth/refresh';
const BFF_LOGOUT_PATH = '/api/auth/logout';

type BffTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | string;
  expires_in?: number | string;
  token_type?: string;
  error?: string;
  error_code?: string;
  detail?: string;
  ready?: boolean;
};

/** The host answered with a document or 404, so these routes are not mounted. */
export class BffRouteMissingError extends Error {
  constructor() {
    super('BFF routes are not available');
    this.name = 'BffRouteMissingError';
  }
}

export const isBffRouteMissingError = (error: unknown): boolean =>
  error instanceof BffRouteMissingError ||
  (typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'BffRouteMissingError');

let probeResult: Promise<boolean> | null = null;

/** Drop the cached probe. Tests call this between cases. */
export function resetBffRouteProbeForTests(): void {
  probeResult = null;
}

/** Later resolves report the routes as absent, without another probe. */
export function markBffRoutesUnavailable(): void {
  probeResult = Promise.resolve(false);
}

const responseIsJson = (response: Response): boolean =>
  (response.headers.get('content-type') ?? '').includes('application/json');

async function readJson(response: Response): Promise<BffTokenResponse | null> {
  try {
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== 'object') return null;
    return payload as BffTokenResponse;
  } catch {
    return null;
  }
}

/**
 * One GET per page load. HTML from a static host, a 404, or a failed fetch
 * means the routes are absent. The result is cached so a miss cannot loop.
 */
export function probeBffAuthRoutes(): Promise<boolean> {
  if (!probeResult) {
    probeResult = (async () => {
      try {
        const response = await fetch(BFF_SESSION_PATH, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          redirect: 'manual',
        });
        if (!response.ok || !responseIsJson(response)) return false;
        const payload = await readJson(response);
        return payload?.ready === true;
      } catch {
        return false;
      }
    })();
  }
  return probeResult;
}

/**
 * Shellui page should try the host cookie when the backend is Shellui and
 * `security.bffAuth.enabled` is not false. The probe decides whether the
 * routes exist. Supabase and an explicit `false` skip the probe.
 */
export async function resolveBffAuthRoutes(input: {
  backendType: string | undefined;
  explicitlyDisabled: boolean;
}): Promise<boolean> {
  if (input.explicitlyDisabled || input.backendType !== 'shellui') return false;
  if (typeof window === 'undefined') return false;
  return probeBffAuthRoutes();
}

const sessionFromHostPayload = (
  payload: BffTokenResponse,
  current: AuthSession | null,
  nowSeconds: number,
): AuthSession | null => {
  const { refresh_token: _dropped, ...rest } = payload;
  const built = buildSessionFromTokenPayload(rest, nowSeconds, { refreshTokenRequired: false });
  if (!built?.accessToken) return null;
  return {
    ...built,
    refreshToken: '',
    provider: built.provider ?? current?.provider ?? null,
    userPreferences: current?.userPreferences ?? built.userPreferences,
  };
};

const throwForHostResponse = (response: Response, payload: BffTokenResponse | null): never => {
  if (response.status === 404 || !responseIsJson(response)) {
    throw new BffRouteMissingError();
  }
  const err = payload?.error ?? payload?.detail;
  const message =
    typeof err === 'string' && err.trim()
      ? `${err} (HTTP ${response.status})`
      : `HTTP ${response.status}`;
  const code = typeof payload?.error_code === 'string' ? payload.error_code.trim() : null;
  throw new AuthRequestError(message, code);
};

/**
 * Exchange a one-time auth code on the shell host. The refresh token stays in
 * the host cookie. This request body never includes `refresh_token`.
 */
export const exchangeAuthCodeViaBff = async ({
  authCode,
  redirectTo,
  codeVerifier,
  nowSeconds,
}: {
  authCode: string;
  redirectTo: string;
  codeVerifier?: string;
  nowSeconds: number;
}): Promise<AuthSession | null> => {
  const response = await fetch(BFF_SESSION_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_code: authCode,
      redirect_to: redirectTo,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  });
  const payload = responseIsJson(response) ? await readJson(response) : null;
  if (!response.ok || !responseIsJson(response)) {
    throwForHostResponse(response, payload);
  }
  if (!payload) return null;
  return sessionFromHostPayload(payload, null, nowSeconds);
};

/**
 * Code exchange for the shell session. When the host routes are up, the page
 * does not call identity. A missing route falls back once to the direct
 * exchange. An identity error does not fall back: the code may already be spent.
 */
export async function exchangeShellSessionCode(input: {
  useBff: boolean;
  authCode: string;
  redirectTo: string;
  codeVerifier?: string;
  nowSeconds: number;
  exchangeDirect: () => Promise<AuthSession | null>;
}): Promise<AuthSession | null> {
  if (!input.useBff) return input.exchangeDirect();
  try {
    return await exchangeAuthCodeViaBff(input);
  } catch (error) {
    if (!isBffRouteMissingError(error)) throw error;
    markBffRoutesUnavailable();
    return input.exchangeDirect();
  }
}

/** Profile in localStorage, no refresh token in sessionStorage or in the returned session. */
export function rememberHostCookieSession(session: AuthSession): AuthSession {
  const next = { ...session, refreshToken: '' };
  persistAuthSession(next, { storeRefreshToken: false });
  return next;
}

/** Refresh the access token from the shell-host cookie. */
export const refreshBffAuthSession = async (
  current: AuthSession,
  nowSeconds: number,
): Promise<AuthSession | null> => {
  const response = await fetch(BFF_REFRESH_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const payload = responseIsJson(response) ? await readJson(response) : null;
  if (!response.ok) {
    throwForHostResponse(response, payload);
  }
  if (!payload) return null;
  return sessionFromHostPayload(payload, current, nowSeconds);
};

/** Clear the host cookie. Identity revocation happens on the host, from the cookie. */
export const logoutBffAuthSession = async (accessToken: string | null | undefined) => {
  await fetch(BFF_LOGOUT_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  }).catch(() => {
    // Local session is cleared either way.
  });
};
