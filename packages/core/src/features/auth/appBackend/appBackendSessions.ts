import { getLogger } from '@shellui/sdk';
import type { BackendConfig, ShellUIConfig } from '../../config/types';
import { createAuthBackend } from '../backends';
import type { AuthBackend } from '../backends/types';
import type { AuthSession } from '../types';
import { accessTokenRefreshDue } from '../utils/accessTokenRefreshDue';
import {
  listDistinctAppBackends,
  resolveFrameAppBackend,
  type ResolvedAppBackend,
} from './identity';
import { runSilentPkceSignIn, type SilentSignInOutcome } from './silentSignIn';

const logger = getLogger('shellcore');

/** Tab-scoped refresh tokens for app identity servers. Not the shell refresh key. */
export const APP_BACKEND_REFRESH_PREFIX = 'shellui.auth.app.refresh.';

type AppBackendClient = Pick<
  AuthBackend,
  'refreshAuthSession' | 'exchangeOAuthSessionCode' | 'logout'
>;

type StoredEntry = {
  identity: ResolvedAppBackend;
  session: AuthSession;
};

const memory = new Map<string, StoredEntry>();
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<string | null>>();
const silentAttempted = new Set<string>();
const listeners = new Set<() => void>();

let backendFactory: (config: BackendConfig) => AppBackendClient = createAuthBackend;
let signInImpl: (input: {
  backendUrl: string;
  provider: string;
  companyId?: string | number;
}) => Promise<SilentSignInOutcome> = runSilentPkceSignIn;

export function setAppBackendFactory(factory: (config: BackendConfig) => AppBackendClient): void {
  backendFactory = factory;
}

export function setAppBackendSignIn(
  signIn: (input: {
    backendUrl: string;
    provider: string;
    companyId?: string | number;
  }) => Promise<SilentSignInOutcome>,
): void {
  signInImpl = signIn;
}

export function resetAppBackendSilentAttempts(): void {
  silentAttempted.clear();
}

export function subscribeAppBackendSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppBackendSession(key: string): AuthSession | null {
  return memory.get(key)?.session ?? null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function storageKey(key: string): string {
  return `${APP_BACKEND_REFRESH_PREFIX}${encodeURIComponent(key)}`;
}

function readRefresh(key: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

function writeRefresh(key: string, refreshToken: string | null): void {
  try {
    if (refreshToken) sessionStorage.setItem(storageKey(key), refreshToken);
    else sessionStorage.removeItem(storageKey(key));
  } catch {
    // Ignore quota / private mode.
  }
}

function clearAllRefresh(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(APP_BACKEND_REFRESH_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) sessionStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function toBackendConfig(identity: ResolvedAppBackend): BackendConfig {
  return {
    type: identity.type,
    url: identity.url,
    ...(identity.companyId !== undefined ? { companyId: identity.companyId } : {}),
    ...(identity.publishableKey ? { publishableKey: identity.publishableKey } : {}),
  };
}

function sessionForRefresh(refreshToken: string, accessToken = ''): AuthSession {
  return {
    accessToken,
    refreshToken,
    tokenType: 'bearer',
    expiresAt: 0,
    provider: null,
    userId: null,
    userEmail: null,
    userName: null,
    userAvatarUrl: null,
    userIsStaff: false,
    userIsCompanyOwner: false,
    userGroups: [],
  };
}

function clearTimer(key: string): void {
  const timer = refreshTimers.get(key);
  if (timer) clearTimeout(timer);
  refreshTimers.delete(key);
}

function remember(identity: ResolvedAppBackend, session: AuthSession): void {
  memory.set(identity.key, { identity, session });
  writeRefresh(identity.key, session.refreshToken || null);
  clearTimer(identity.key);
  const now = Date.now() / 1000;
  const delaySec = Math.max(5, session.expiresAt - now - 90);
  const timer = setTimeout(() => {
    void ensureAppBackendSession(identity, { allowSilent: false });
  }, delaySec * 1000);
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    timer.unref();
  }
  refreshTimers.set(identity.key, timer);
  notify();
}

function forget(key: string): void {
  memory.delete(key);
  writeRefresh(key, null);
  clearTimer(key);
  notify();
}

function isUnauthorized(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return /\b401\b/.test(message);
}

async function doEnsure(
  identity: ResolvedAppBackend,
  allowSilent: boolean,
): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const current = memory.get(identity.key)?.session ?? null;
  if (current?.accessToken && !accessTokenRefreshDue(current.expiresAt, now)) {
    return current.accessToken;
  }

  const refreshToken = current?.refreshToken || readRefresh(identity.key);
  if (refreshToken) {
    try {
      const next = await backendFactory(toBackendConfig(identity)).refreshAuthSession(
        current ? { ...current, refreshToken } : sessionForRefresh(refreshToken),
        now,
      );
      if (next?.accessToken) {
        remember(identity, next);
        return next.accessToken;
      }
      forget(identity.key);
    } catch (err) {
      if (isUnauthorized(err)) forget(identity.key);
      else return current?.accessToken ?? null;
    }
  }

  if (!allowSilent || identity.type !== 'shellui' || !identity.provider) return null;
  if (silentAttempted.has(identity.key)) return null;
  silentAttempted.add(identity.key);

  let outcome: SilentSignInOutcome;
  try {
    outcome = await signInImpl({
      backendUrl: identity.url,
      provider: identity.provider,
      companyId: identity.companyId,
    });
  } catch {
    logger.info('Silent sign-in did not complete for an app identity server', {
      url: identity.url,
    });
    return null;
  }
  if (!outcome.ok) {
    logger.info('Silent sign-in did not complete for an app identity server', {
      url: identity.url,
      reason: outcome.reason,
    });
    return null;
  }

  try {
    const session = await backendFactory(toBackendConfig(identity)).exchangeOAuthSessionCode({
      authCode: outcome.authCode,
      redirectTo: outcome.redirectTo,
      codeVerifier: outcome.codeVerifier,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!session?.accessToken) return null;
    remember(identity, session);
    return session.accessToken;
  } catch {
    logger.info('Silent sign-in did not complete for an app identity server', {
      url: identity.url,
    });
    return null;
  }
}

export function ensureAppBackendSession(
  identity: ResolvedAppBackend,
  options?: { allowSilent?: boolean },
): Promise<string | null> {
  const existing = inFlight.get(identity.key);
  if (existing) return existing;
  const allowSilent = options?.allowSilent !== false;
  const run = doEnsure(identity, allowSilent).finally(() => {
    if (inFlight.get(identity.key) === run) inFlight.delete(identity.key);
  });
  inFlight.set(identity.key, run);
  return run;
}

export async function refreshAppBackendSessionIfDue(
  frameSrc: string,
  config?: ShellUIConfig,
): Promise<void> {
  const resolved = resolveFrameAppBackend(frameSrc, config);
  if (resolved.kind !== 'foreign') return;
  await ensureAppBackendSession(resolved.identity, { allowSilent: false });
}

export async function ensureConfiguredAppBackends(
  config: ShellUIConfig | undefined,
  options?: { allowSilent?: boolean },
): Promise<void> {
  const identities = listDistinctAppBackends(config);
  for (const identity of identities) {
    await ensureAppBackendSession(identity, options);
  }
}

/** Drop every app session. Refresh tokens for the shell session are left in place. */
export async function endAppBackendSessions(): Promise<void> {
  const snapshot = [...memory.values()];
  memory.clear();
  for (const timer of refreshTimers.values()) clearTimeout(timer);
  refreshTimers.clear();
  inFlight.clear();
  silentAttempted.clear();
  clearAllRefresh();
  notify();
  await Promise.all(
    snapshot.map(async (entry) => {
      try {
        await backendFactory(toBackendConfig(entry.identity)).logout(entry.session);
      } catch {
        // The local session is already gone.
      }
    }),
  );
}
