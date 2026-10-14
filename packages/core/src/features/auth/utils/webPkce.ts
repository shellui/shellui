/**
 * PKCE S256 for browser sign-in (OAuth redirect and magic link).
 * Parameter names match the desktop flow: `code_challenge`, `code_challenge_method`,
 * `code_verifier`. The verifier stays in this origin's localStorage so a magic
 * link opened in another tab of the same browser can finish the exchange.
 */

import type { AuthBackend } from '../backends/types';
import { normalizeRedirectPath } from './normalizeRedirectPath';
import { createPkcePair } from './pkce';

const WEB_PKCE_STORAGE_KEY = 'shellui.auth.web.pkce';
const AUTH_CODE_PARAM = 'shellui_auth_code';
/** Same window as a desktop attempt. A magic-link click can be later than the code TTL. */
const WEB_PKCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PendingWebPkce = {
  verifier: string;
  redirectKey: string;
  createdAt: number;
};

function webStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Stable key so query order does not hide the verifier on the callback. */
export function webPkceRedirectKey(redirectTo: string): string {
  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return redirectTo;
  }
  const params = [...url.searchParams.entries()]
    .filter(([key]) => key !== AUTH_CODE_PARAM)
    .sort((left, right) =>
      left[0] === right[0] ? left[1].localeCompare(right[1]) : left[0].localeCompare(right[0]),
    );
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

export function shelluiWebOAuthRedirectTo(input: {
  origin: string;
  redirectPath: string;
  provider: string;
  oauthClientId?: number;
}): string {
  const redirectToUrl = new URL(`${input.origin}${normalizeRedirectPath(input.redirectPath)}`);
  redirectToUrl.searchParams.set('provider', input.provider);
  if (
    typeof input.oauthClientId === 'number' &&
    Number.isFinite(input.oauthClientId) &&
    input.oauthClientId > 0
  ) {
    redirectToUrl.searchParams.set(
      'company_oauth_client_id',
      String(Math.trunc(input.oauthClientId)),
    );
  }
  return redirectToUrl.toString();
}

export function shelluiWebMagicLinkRedirectTo(origin: string, redirectPath: string): string {
  return `${origin}${normalizeRedirectPath(redirectPath)}`;
}

function readPending(): PendingWebPkce | null {
  const store = webStore();
  if (!store) return null;
  try {
    const raw = store.getItem(WEB_PKCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWebPkce;
    if (
      !parsed ||
      typeof parsed.verifier !== 'string' ||
      typeof parsed.redirectKey !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      Date.now() - parsed.createdAt > WEB_PKCE_MAX_AGE_MS
    ) {
      store.removeItem(WEB_PKCE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWebPkce(): void {
  const store = webStore();
  if (!store) return;
  try {
    store.removeItem(WEB_PKCE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function createAndStoreWebPkce(
  redirectTo: string,
): Promise<{ verifier: string; challenge: string }> {
  const store = webStore();
  if (!store) {
    throw new Error('This browser cannot store the sign-in check. Allow site data and try again.');
  }
  const { verifier, challenge } = await createPkcePair();
  const pending: PendingWebPkce = {
    verifier,
    redirectKey: webPkceRedirectKey(redirectTo),
    createdAt: Date.now(),
  };
  try {
    store.setItem(WEB_PKCE_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    throw new Error('This browser cannot store the sign-in check. Allow site data and try again.');
  }
  return { verifier, challenge };
}

/** Returns the verifier once when the callback redirect matches the attempt that stored it. */
export function consumeWebPkce(redirectTo: string): string | null {
  const pending = readPending();
  if (!pending) return null;
  if (pending.redirectKey !== webPkceRedirectKey(redirectTo)) return null;
  clearWebPkce();
  return pending.verifier;
}

export async function beginShelluiWebOAuth(input: {
  origin: string;
  provider: string;
  redirectPath: string;
  oauthClientId?: number;
  startOAuth: AuthBackend['startOAuth'];
}): Promise<void> {
  const redirectTo = shelluiWebOAuthRedirectTo({
    origin: input.origin,
    redirectPath: input.redirectPath,
    provider: input.provider,
    oauthClientId: input.oauthClientId,
  });
  const { challenge } = await createAndStoreWebPkce(redirectTo);
  input.startOAuth(input.provider, input.redirectPath, input.oauthClientId, {
    codeChallenge: challenge,
  });
}

export async function beginShelluiWebMagicLink(input: {
  origin: string;
  email: string;
  redirectPath: string;
  language?: string;
  sendMagicLink: AuthBackend['sendMagicLink'];
}): Promise<void> {
  const redirectTo = shelluiWebMagicLinkRedirectTo(input.origin, input.redirectPath);
  const { challenge } = await createAndStoreWebPkce(redirectTo);
  try {
    await input.sendMagicLink(input.email, input.redirectPath, {
      language: input.language,
      codeChallenge: challenge,
    });
  } catch (error) {
    clearWebPkce();
    throw error;
  }
}
