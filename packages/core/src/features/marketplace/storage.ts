import { OVERLAY_LIMITS, isPrivateOrLoopbackHost } from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import {
  NAVIGATION_OVERLAY_ENDPOINT,
  NAVIGATION_OVERLAY_STORAGE_KEY,
} from './normalizeMarketplaceConfig';
import {
  emptyNavigationOverlay,
  parseNavigationOverlay,
  type NavigationOverlay,
  type NavigationStorageAdapter,
  type OverlayValidationContext,
} from './overlay';

export type NavigationStorageMode = 'auto' | 'localStorage' | 'api';

/** Whose layout this is. One layout is kept for each user and company. */
export interface NavigationLayoutScope {
  userId: string | null;
  companyId: string | null;
}

export interface NavigationStorageOptions {
  mode: NavigationStorageMode;
  /** True when a Shellui identity server, or an explicit overlay API URL, is configured. */
  identityConfigured: boolean;
  /** True when the shell has an access token for the signed-in person. */
  isSignedIn: () => boolean;
  getAccessToken: () => string | null | Promise<string | null>;
  /** Shellui identity base URL (`backend.url`). */
  identityBaseUrl?: string | null;
  /** `navigationCustomization.apiUrl`, when set. */
  apiUrl?: string | null;
  /** The signed-in user and company. A signed-out device uses the device layout. */
  scope?: () => NavigationLayoutScope;
  /** Checks applied to every layout read from storage. */
  validation?: () => OverlayValidationContext;
  /** Origins that may receive the access token. Defaults to the identity base URL origin. */
  knownApiOrigins?: readonly string[];
  /** Development builds only: allow `http://localhost` for the layout API. */
  allowLocalhost?: boolean;
  storage?: Storage;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export function resolveNavigationOverlayUrl(options: {
  apiUrl?: string | null;
  identityBaseUrl?: string | null;
}): string | null {
  const explicit = options.apiUrl?.trim().replace(/\/+$/, '');
  const identity = options.identityBaseUrl?.trim().replace(/\/+$/, '');
  const base = explicit || identity;
  if (!base) return null;
  if (/\/navigation-overlay$/i.test(base)) return base;
  return `${base}${NAVIGATION_OVERLAY_ENDPOINT}`;
}

/**
 * The layout API URL, only when it is safe to send the access token there:
 * https (or http localhost in development) on an origin the shell already trusts.
 */
export function resolveTrustedNavigationOverlayUrl(options: {
  apiUrl?: string | null;
  identityBaseUrl?: string | null;
  knownApiOrigins?: readonly string[];
  allowLocalhost?: boolean;
}): string | null {
  const url = resolveNavigationOverlayUrl(options);
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const local = isPrivateOrLoopbackHost(parsed.hostname);
  if (parsed.username || parsed.password) return null;
  if (parsed.protocol === 'https:') {
    if (local && !options.allowLocalhost) return null;
  } else if (!(parsed.protocol === 'http:' && local && options.allowLocalhost)) {
    return null;
  }
  const known = new Set(options.knownApiOrigins ?? []);
  const identityOrigin = options.identityBaseUrl ? originOf(options.identityBaseUrl) : null;
  if (!options.knownApiOrigins && identityOrigin) known.add(identityOrigin);
  return known.has(parsed.origin) ? url : null;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** localStorage key for one layout. A signed-out device keeps the original key. */
export function navigationLayoutStorageKey(scope?: NavigationLayoutScope | null): string {
  if (!scope?.userId) return NAVIGATION_OVERLAY_STORAGE_KEY;
  const company = scope.companyId?.trim() || 'none';
  return `${NAVIGATION_OVERLAY_STORAGE_KEY}.${encodeURIComponent(scope.userId)}.${encodeURIComponent(company)}`;
}

function defaultValidation(now: () => string): () => OverlayValidationContext {
  return () => ({
    now: now(),
    shellOrigin: typeof window !== 'undefined' ? window.location.origin : null,
  });
}

export function createLocalStorageNavigationAdapter(
  storage: Storage,
  options: {
    now?: () => string;
    scope?: () => NavigationLayoutScope;
    validation?: () => OverlayValidationContext;
  } = {},
): NavigationStorageAdapter {
  const now = options.now ?? (() => new Date().toISOString());
  const validation = options.validation ?? defaultValidation(now);
  const key = () => navigationLayoutStorageKey(options.scope?.());
  const read = (): NavigationOverlay | null => {
    try {
      const raw = storage.getItem(key());
      if (!raw || raw.length > OVERLAY_LIMITS.maxBytes) return null;
      return parseNavigationOverlay(JSON.parse(raw) as unknown, validation());
    } catch {
      return null;
    }
  };
  return {
    readDevice: read,
    async load() {
      return { overlay: read(), etag: null };
    },
    async save(overlay) {
      storage.setItem(key(), JSON.stringify(overlay));
    },
    async reset() {
      storage.removeItem(key());
    },
  };
}

/** The saved layout changed on another device since it was last read. */
export class NavigationOverlayConflictError extends Error {
  constructor() {
    super('navigation_overlay_conflict');
    this.name = 'NavigationOverlayConflictError';
  }
}

/**
 * Identity could not be reached or refused the write (anything but a conflict). Only the device
 * copy changed, and identity still has the older layout, which wins on the next load.
 */
export class NavigationOverlayDeviceOnlyError extends Error {
  constructor() {
    super('navigation_overlay_device_only');
    this.name = 'NavigationOverlayDeviceOnlyError';
  }
}

/**
 * The signed-in user or company changed while the call was in flight. Nothing was stored for
 * the new scope (no version, no device copy). `stored` says whether identity accepted the write
 * for the scope the call started in.
 */
export class NavigationOverlayScopeChangedError extends Error {
  constructor(readonly stored = false) {
    super('navigation_overlay_scope_changed');
    this.name = 'NavigationOverlayScopeChangedError';
  }
}

const scopeKeyOf = (options: { scope?: () => NavigationLayoutScope }) =>
  navigationLayoutStorageKey(options.scope?.());

/** Throw when the scope a call started in is no longer the active one. */
function assertScope(options: { scope?: () => NavigationLayoutScope }, at: string, stored = false) {
  if (scopeKeyOf(options) !== at) throw new NavigationOverlayScopeChangedError(stored);
}

export function createApiNavigationAdapter(
  options: NavigationStorageOptions,
): NavigationStorageAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());
  const validation = options.validation ?? defaultValidation(now);
  /**
   * Version of the layout identity last returned, for the scope (user and company) it was read
   * in. Sent back as `If-Match` on a write in that scope only, so another account never sends it.
   * Each call captures its scope when it starts; a response that arrives after the scope changed
   * stores nothing.
   */
  let held: { scope: string; etag: string | null } = { scope: '', etag: null };
  const versionFor = (at: string) => (held.scope === at ? held.etag : null);
  const keep = (at: string, etag: string | null) => {
    assertScope(options, at);
    held = { scope: at, etag };
  };
  const endpoint = () =>
    resolveTrustedNavigationOverlayUrl({
      apiUrl: options.apiUrl,
      identityBaseUrl: options.identityBaseUrl,
      knownApiOrigins: options.knownApiOrigins,
      allowLocalhost: options.allowLocalhost,
    });

  const request = async (
    method: 'GET' | 'PUT' | 'DELETE',
    body: NavigationOverlay | undefined,
    version: string | null,
  ) => {
    const url = endpoint();
    if (!url) throw new Error('navigation_overlay_untrusted_url');
    const token = await options.getAccessToken();
    if (!token) throw new Error('not_signed_in');
    const response = await fetchImpl(url, {
      method,
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' && version ? { 'If-Match': version } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response;
  };
  const etagOf = (response: Response) =>
    (response.ok ? response.headers?.get?.('ETag') : null) || null;

  return {
    // A read never moves the ETag by itself. A 412 carries one too, but this device has not
    // read that layout. The version moves only on a successful write, or when the caller
    // commits a layout it read (`adoptVersion`).
    async load() {
      const at = scopeKeyOf(options);
      const response = await request('GET', undefined, null);
      assertScope(options, at);
      if (response.status === 404 || response.status === 204) return { overlay: null, etag: null };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const version = etagOf(response);
      const payload = (await response.json()) as unknown;
      return { overlay: parseNavigationOverlay(payload, validation()), etag: version };
    },
    adoptVersion(version) {
      keep(scopeKeyOf(options), version);
    },
    async save(overlay) {
      const at = scopeKeyOf(options);
      const response = await request('PUT', overlay, versionFor(at));
      assertScope(options, at, response.ok);
      if (response.status === 412) throw new NavigationOverlayConflictError();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      keep(at, etagOf(response) ?? versionFor(at));
    },
    async reset(ifMatch) {
      const at = scopeKeyOf(options);
      const response = await request(
        'DELETE',
        undefined,
        ifMatch === undefined ? versionFor(at) : ifMatch,
      );
      assertScope(options, at, response.ok || response.status === 404);
      if (response.status === 412) throw new NavigationOverlayConflictError();
      if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
      keep(at, null);
    },
  };
}

function useIdentity(options: NavigationStorageOptions): boolean {
  if (options.mode === 'localStorage') return false;
  if (options.mode === 'api') return true;
  return options.identityConfigured && options.isSignedIn();
}

/**
 * Layout storage. Signed in, the layout lives in identity, one per user and company, with the
 * scoped device copy as a fallback. The device layout from before sign-in is never uploaded:
 * a person who wants it shared installs those apps again, and confirms each one.
 */
export function createNavigationStorageAdapter(
  options: NavigationStorageOptions,
): NavigationStorageAdapter {
  const memory =
    options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
  const local = createLocalStorageNavigationAdapter(memory, options);
  const api = createApiNavigationAdapter(options);
  /**
   * Identity writes are numbered as they start. Once identity stores one, the device copy of the
   * scope the call started in is removed, also when another account is active by then: a copy
   * left by an earlier failed save would otherwise bring back, while identity is down, what the
   * stored write took away. A fallback copy from a write that started before the last stored
   * one in its scope is skipped, so it never replaces a newer stored layout.
   */
  let writes = 0;
  const lastStored = new Map<string, number>();
  const stored = (at: string, id: number) => {
    memory.removeItem(at);
    lastStored.set(at, Math.max(lastStored.get(at) ?? 0, id));
  };
  const write = async (at: string, id: number, call: () => Promise<void>) => {
    try {
      await call();
    } catch (error) {
      if (error instanceof NavigationOverlayScopeChangedError && error.stored) stored(at, id);
      throw error;
    }
    stored(at, id);
  };

  return {
    readDevice: () => local.readDevice?.() ?? null,
    async loadRemote() {
      return useIdentity(options) ? api.load() : local.load();
    },
    adoptVersion(version) {
      api.adoptVersion?.(version);
    },
    // The device copy is read or written only for the scope the call started in, never for an
    // account that signed in while identity was answering.
    async load() {
      if (!useIdentity(options)) return local.load();
      const at = scopeKeyOf(options);
      try {
        return await api.load();
      } catch (error) {
        if (error instanceof NavigationOverlayScopeChangedError) throw error;
        assertScope(options, at);
        return local.load();
      }
    },
    async save(overlay) {
      if (!useIdentity(options)) {
        await local.save(overlay);
        return;
      }
      const at = scopeKeyOf(options);
      const id = ++writes;
      try {
        await write(at, id, () => api.save(overlay));
      } catch (error) {
        // A conflict is not an outage. Falling back would hide that another device changed
        // the layout, so the caller reloads the remote copy and tells the person.
        if (error instanceof NavigationOverlayConflictError) throw error;
        if (error instanceof NavigationOverlayScopeChangedError) throw error;
        assertScope(options, at);
        if ((lastStored.get(at) ?? 0) < id) await local.save(overlay);
        throw new NavigationOverlayDeviceOnlyError();
      }
    },
    async reset(ifMatch) {
      let deviceOnly = false;
      const at = scopeKeyOf(options);
      if (useIdentity(options)) {
        try {
          await write(at, ++writes, async () => api.reset?.(ifMatch));
        } catch (error) {
          // A conflict leaves the saved layout in place. Keep the device copy too, and let the
          // caller retry or report that nothing was reset.
          if (error instanceof NavigationOverlayConflictError) throw error;
          if (error instanceof NavigationOverlayScopeChangedError) throw error;
          // Any other failure still clears the device copy, and the caller is told.
          deviceOnly = true;
        }
      }
      assertScope(options, at);
      await local.reset?.();
      if (deviceOnly) throw new NavigationOverlayDeviceOnlyError();
    },
  };
}

export function isIdentityConfigured(config: ShellUIConfig, apiUrl?: string | null): boolean {
  if (apiUrl?.trim()) return true;
  return config.backend?.type === 'shellui' && Boolean(config.backend.url?.trim());
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

export { emptyNavigationOverlay };
