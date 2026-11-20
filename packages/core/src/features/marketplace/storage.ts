import type { ShellUIConfig } from '../config/types';
import {
  NAVIGATION_OVERLAY_ENDPOINT,
  NAVIGATION_OVERLAY_STORAGE_KEY,
} from './normalizeMarketplaceConfig';
import {
  emptyNavigationOverlay,
  overlayHasContent,
  parseNavigationOverlay,
  type NavigationOverlay,
  type NavigationStorageAdapter,
} from './overlay';

export type NavigationStorageMode = 'auto' | 'localStorage' | 'api';

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

export function createLocalStorageNavigationAdapter(
  storage: Storage,
  now = () => new Date().toISOString(),
): NavigationStorageAdapter {
  return {
    async load() {
      try {
        const raw = storage.getItem(NAVIGATION_OVERLAY_STORAGE_KEY);
        if (!raw) return null;
        return parseNavigationOverlay(JSON.parse(raw) as unknown, now());
      } catch {
        return null;
      }
    },
    async save(overlay) {
      storage.setItem(NAVIGATION_OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
    },
    async reset() {
      storage.removeItem(NAVIGATION_OVERLAY_STORAGE_KEY);
    },
  };
}

export function createApiNavigationAdapter(
  options: NavigationStorageOptions,
): NavigationStorageAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());
  const endpoint = () =>
    resolveNavigationOverlayUrl({
      apiUrl: options.apiUrl,
      identityBaseUrl: options.identityBaseUrl,
    });

  const request = async (method: 'GET' | 'PUT' | 'DELETE', body?: NavigationOverlay) => {
    const url = endpoint();
    if (!url) throw new Error('navigation_overlay_unconfigured');
    const token = await options.getAccessToken();
    if (!token) throw new Error('not_signed_in');
    const response = await fetchImpl(url, {
      method,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response;
  };

  return {
    async load() {
      const response = await request('GET');
      if (response.status === 404 || response.status === 204) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as unknown;
      return parseNavigationOverlay(payload, now());
    },
    async save(overlay) {
      const response = await request('PUT', overlay);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    },
    async reset() {
      const response = await request('DELETE');
      if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
    },
  };
}

function useIdentity(options: NavigationStorageOptions): boolean {
  if (options.mode === 'localStorage') return false;
  if (options.mode === 'api') return true;
  return options.identityConfigured && options.isSignedIn();
}

export function createNavigationStorageAdapter(
  options: NavigationStorageOptions,
): NavigationStorageAdapter {
  const memory =
    options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
  const local = createLocalStorageNavigationAdapter(memory, options.now);
  const api = createApiNavigationAdapter(options);

  return {
    async load() {
      if (!useIdentity(options)) return local.load();
      try {
        const remote = await api.load();
        if (remote) return remote;
        const cached = await local.load();
        if (overlayHasContent(cached) && cached) {
          try {
            await api.save(cached);
          } catch {
            // Identity is unavailable. Keep the local overlay.
          }
          return cached;
        }
        return null;
      } catch {
        return local.load();
      }
    },
    async save(overlay) {
      if (!useIdentity(options)) {
        await local.save(overlay);
        return;
      }
      try {
        await api.save(overlay);
      } catch {
        await local.save(overlay);
      }
    },
    async reset() {
      if (useIdentity(options)) {
        try {
          await api.reset?.();
        } catch {
          // Still clear the device copy.
        }
      }
      await local.reset?.();
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
