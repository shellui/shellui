import type { ShellUIConfig } from '../../config/types';
import {
  getShellUILoginClientTimezone,
  getShellUILoginCompanyId,
  getShellUILoginDeviceId,
} from './clientLoginContext';
import {
  desktopAuthErrorMessage,
  desktopRedirectUri,
  normalizeDesktopScheme,
  parseDesktopAuthCallback,
} from './desktopAuthCallback';
import { createPkcePair } from './pkce';

const PKCE_STORAGE_KEY = 'shellui.auth.desktop.pkce';
/** One sign-in. Magic-link clicks can be later than the 120s OAuth code. */
const PKCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const PKCE_CHALLENGE_METHOD = 'S256';

type PendingDesktopPkce = {
  verifier: string;
  redirectTo: string;
  createdAt: number;
};

export type DesktopAuthOpenUrl = (url: string) => void | Promise<void>;

export type DesktopAuthUrlListener = (urls: string[]) => void;

/**
 * Subscribe to OS deep links. Wire `@tauri-apps/plugin-deep-link` `onOpenUrl`.
 * Return an unsubscribe function when the plugin provides one.
 */
export type DesktopAuthOnOpenUrl = (
  listener: DesktopAuthUrlListener,
) => void | (() => void) | Promise<void | (() => void)>;

export interface DesktopAuthAdapters {
  /** Open the identity authorize URL in the system browser. */
  openUrl: DesktopAuthOpenUrl;
  /** Optional. When omitted, the shell listens with Tauri's deep-link plugin IPC. */
  onOpenUrl?: DesktopAuthOnOpenUrl;
}

export type DesktopAuthEvent =
  | { type: 'code'; authCode: string; redirectTo: string; codeVerifier: string }
  | { type: 'error'; errorCode: string; message: string };

type TauriInternals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  transformCallback?: (callback: (data: unknown) => void, once?: boolean) => number;
  unregisterCallback?: (id: number) => void;
};

let adapters: DesktopAuthAdapters | null = null;
let activeScheme: string | null = null;
let memoryPending: PendingDesktopPkce | null = null;
let handledCode: string | null = null;
let queued: DesktopAuthEvent | null = null;
const listeners = new Set<(event: DesktopAuthEvent) => void>();
let unlisten: (() => void) | null = null;
let listenerPromise: Promise<void> | null = null;
let replayedLaunchUrl = false;

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function readPending(): PendingDesktopPkce | null {
  if (memoryPending && !isExpired(memoryPending)) return memoryPending;
  memoryPending = null;
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(PKCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDesktopPkce;
    if (
      !parsed ||
      typeof parsed.verifier !== 'string' ||
      typeof parsed.redirectTo !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      isExpired(parsed)
    ) {
      store.removeItem(PKCE_STORAGE_KEY);
      return null;
    }
    memoryPending = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writePending(pending: PendingDesktopPkce): void {
  memoryPending = pending;
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(PKCE_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // The in-memory copy is enough for this sign-in.
  }
}

export function clearDesktopPkce(): void {
  memoryPending = null;
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(PKCE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isExpired(pending: PendingDesktopPkce): boolean {
  return Date.now() - pending.createdAt > PKCE_MAX_AGE_MS;
}

function takePending(): PendingDesktopPkce | null {
  const pending = readPending();
  clearDesktopPkce();
  return pending;
}

export function isLiveTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return !!(w.__TAURI__ ?? w.__TAURI_INTERNALS__);
}

export function shouldUseDesktopSignIn(
  config: Pick<ShellUIConfig, 'auth' | 'backend'> | null | undefined,
  tauriRuntime: boolean = isLiveTauriRuntime(),
): boolean {
  if (!tauriRuntime || config?.backend?.type !== 'shellui') return false;
  return normalizeDesktopScheme(config.auth?.desktopScheme) !== null;
}

/** Set when a Tauri shell has a scheme value that identity-service would refuse. */
export function desktopSignInBlockReason(
  config: Pick<ShellUIConfig, 'auth' | 'backend'> | null | undefined,
  tauriRuntime: boolean,
): string | null {
  if (!tauriRuntime || config?.backend?.type !== 'shellui') return null;
  const raw = config.auth?.desktopScheme;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (normalizeDesktopScheme(raw)) return null;
  return 'auth.desktopScheme must be a lowercase custom scheme such as shellui-playground.';
}

export function setActiveDesktopScheme(scheme: string | null): void {
  activeScheme = scheme ? normalizeDesktopScheme(scheme) : null;
}

export function configureDesktopAuth(next: DesktopAuthAdapters): void {
  adapters = { openUrl: next.openUrl, onOpenUrl: next.onOpenUrl };
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
  listenerPromise = null;
  if (activeScheme) {
    void ensureDesktopDeepLinkListener();
  }
}

export function subscribeDesktopAuth(listener: (event: DesktopAuthEvent) => void): () => void {
  listeners.add(listener);
  if (queued) {
    const event = queued;
    queued = null;
    listener(event);
  }
  return () => {
    listeners.delete(listener);
  };
}

function emitDesktopAuth(event: DesktopAuthEvent): void {
  if (listeners.size === 0) {
    queued = event;
    return;
  }
  for (const listener of listeners) listener(event);
}

export function buildDesktopAuthorizeUrl(input: {
  backendUrl: string;
  companyId?: string;
  provider: string;
  oauthClientId?: number;
  redirectTo: string;
  codeChallenge: string;
  clientTimezone?: string;
  clientDeviceId?: string;
}): string {
  const authorizeUrl = new URL(`${input.backendUrl.replace(/\/+$/, '')}/api/v1/authorize`);
  authorizeUrl.searchParams.set('provider', input.provider);
  authorizeUrl.searchParams.set('redirect_to', input.redirectTo);
  authorizeUrl.searchParams.set('code_challenge', input.codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', PKCE_CHALLENGE_METHOD);
  if (
    typeof input.oauthClientId === 'number' &&
    Number.isFinite(input.oauthClientId) &&
    input.oauthClientId > 0
  ) {
    authorizeUrl.searchParams.set(
      'company_oauth_client_id',
      String(Math.trunc(input.oauthClientId)),
    );
  }
  if (input.companyId) {
    authorizeUrl.searchParams.set('company_id', input.companyId);
  }
  if (input.clientTimezone) {
    authorizeUrl.searchParams.set('client_timezone', input.clientTimezone);
  }
  if (input.clientDeviceId) {
    authorizeUrl.searchParams.set('client_device_id', input.clientDeviceId);
  }
  return authorizeUrl.toString();
}

export async function createAndStoreDesktopPkce(
  scheme: string,
): Promise<{ challenge: string; redirectTo: string }> {
  const normalized = normalizeDesktopScheme(scheme);
  if (!normalized) {
    throw new Error(
      'auth.desktopScheme must be a lowercase custom scheme such as shellui-playground.',
    );
  }
  const redirectTo = desktopRedirectUri(normalized);
  const { verifier, challenge } = await createPkcePair();
  handledCode = null;
  writePending({ verifier, redirectTo, createdAt: Date.now() });
  return { challenge, redirectTo };
}

function getTauriInternals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null;
}

async function openSystemBrowser(url: string): Promise<void> {
  if (adapters?.openUrl) {
    await adapters.openUrl(url);
    return;
  }
  const internals = getTauriInternals();
  if (!internals?.invoke) {
    throw new Error(
      'Desktop sign-in needs a system browser opener. Call configureDesktopAuth({ openUrl }).',
    );
  }
  try {
    await internals.invoke('plugin:opener|open_url', { url });
  } catch {
    throw new Error(
      'Desktop sign-in could not open the system browser. Add the Tauri opener plugin, or pass openUrl to configureDesktopAuth.',
    );
  }
}

export async function beginDesktopOAuth(input: {
  backendUrl: string;
  companyId?: string | number;
  provider: string;
  oauthClientId?: number;
  scheme: string;
}): Promise<void> {
  const scheme = normalizeDesktopScheme(input.scheme);
  if (!scheme) {
    throw new Error(
      'auth.desktopScheme must be a lowercase custom scheme such as shellui-playground.',
    );
  }
  const backendUrl = input.backendUrl?.replace(/\/+$/, '') ?? '';
  if (!backendUrl) {
    throw new Error('Missing Shellui backend URL.');
  }
  setActiveDesktopScheme(scheme);
  const prepared = await createAndStoreDesktopPkce(scheme);
  const authorizeUrl = buildDesktopAuthorizeUrl({
    backendUrl,
    companyId: getShellUILoginCompanyId(input.companyId),
    provider: input.provider,
    oauthClientId: input.oauthClientId,
    redirectTo: prepared.redirectTo,
    codeChallenge: prepared.challenge,
    clientTimezone: getShellUILoginClientTimezone(),
    clientDeviceId: getShellUILoginDeviceId(),
  });
  try {
    await openSystemBrowser(authorizeUrl);
  } catch (error) {
    clearDesktopPkce();
    throw error;
  }
  try {
    // Skip the launch URL here. A previous deep link would spend the verifier
    // stored for this attempt.
    await ensureDesktopDeepLinkListener({ replayLaunchUrl: false });
  } catch {
    // The browser is already open. The app can still forward the deep link.
  }
}

/**
 * Feed one deep-link URL, for example from `@tauri-apps/plugin-deep-link` `onOpenUrl`.
 * Codes, verifiers, and tokens are not logged.
 */
export function handleDesktopAuthCallback(rawUrl: string): void {
  const scheme = activeScheme;
  if (!scheme || typeof rawUrl !== 'string' || !rawUrl) return;
  const parsed = parseDesktopAuthCallback(rawUrl, scheme);
  if (!parsed) return;

  if (parsed.kind === 'error') {
    clearDesktopPkce();
    emitDesktopAuth({ type: 'error', errorCode: parsed.errorCode, message: parsed.message });
    return;
  }

  if (handledCode === parsed.authCode) return;
  handledCode = parsed.authCode;
  const pending = takePending();
  if (!pending) {
    emitDesktopAuth({
      type: 'error',
      errorCode: 'desktop_signin_expired',
      message: desktopAuthErrorMessage('desktop_signin_expired'),
    });
    return;
  }
  emitDesktopAuth({
    type: 'code',
    authCode: parsed.authCode,
    redirectTo: pending.redirectTo,
    codeVerifier: pending.verifier,
  });
}

function urlsFromDeepLinkPayload(data: unknown): string[] {
  const payload =
    data && typeof data === 'object' && data !== null && 'payload' in data
      ? (data as { payload?: unknown }).payload
      : data;
  if (!Array.isArray(payload)) return [];
  return payload.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

async function readCurrentDeepLinks(): Promise<void> {
  const internals = getTauriInternals();
  if (!internals?.invoke) return;
  try {
    const current = await internals.invoke('plugin:deep-link|get_current');
    for (const url of urlsFromDeepLinkPayload(current)) {
      handleDesktopAuthCallback(url);
    }
  } catch {
    // The deep-link plugin is optional until the desktop app registers it.
  }
}

export function ensureDesktopDeepLinkListener(options?: {
  replayLaunchUrl?: boolean;
}): Promise<void> {
  const replay = options?.replayLaunchUrl !== false;
  if (listenerPromise) {
    if (replay && !replayedLaunchUrl) {
      replayedLaunchUrl = true;
      return listenerPromise.then(() => readCurrentDeepLinks());
    }
    return listenerPromise;
  }
  listenerPromise = attachDeepLinkListener(replay).catch((error) => {
    listenerPromise = null;
    throw error;
  });
  return listenerPromise;
}

async function attachDeepLinkListener(replayLaunchUrl: boolean): Promise<void> {
  if (replayLaunchUrl && !replayedLaunchUrl) {
    replayedLaunchUrl = true;
    await readCurrentDeepLinks();
  }
  if (adapters?.onOpenUrl) {
    const result = await adapters.onOpenUrl((urls) => {
      for (const url of urls) handleDesktopAuthCallback(url);
    });
    if (typeof result === 'function') {
      unlisten = () => {
        result();
      };
    }
    return;
  }

  const internals = getTauriInternals();
  if (!internals?.invoke || !internals.transformCallback) return;
  const callbackId = internals.transformCallback((data) => {
    for (const url of urlsFromDeepLinkPayload(data)) {
      handleDesktopAuthCallback(url);
    }
  }, false);
  try {
    const eventId = (await internals.invoke('plugin:event|listen', {
      event: 'deep-link://new-url',
      target: { kind: 'Any' },
      handler: callbackId,
    })) as number;
    unlisten = () => {
      internals.unregisterCallback?.(callbackId);
      void internals
        .invoke('plugin:event|unlisten', { event: 'deep-link://new-url', eventId })
        .catch(() => undefined);
    };
  } catch {
    internals.unregisterCallback?.(callbackId);
  }
}

/** Test-only reset. Not part of the app API. */
export function resetDesktopAuthState(): void {
  if (unlisten) unlisten();
  unlisten = null;
  listenerPromise = null;
  replayedLaunchUrl = false;
  adapters = null;
  activeScheme = null;
  handledCode = null;
  queued = null;
  listeners.clear();
  clearDesktopPkce();
}
