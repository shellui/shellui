/**
 * Route sync for apps that run inside a Shellui shell without a router library.
 *
 * Up: `navigateApp` writes the browser URL. Once `shellui.init()` ran, the SDK
 * reports every history change to the shell (SHELLUI_URL_CHANGED), so the shell URL follows.
 * Down: back, forward and deep links from the shell load or replace the frame URL.
 * `subscribeAppLocation` fires on every one of those changes.
 */

export const APP_LOCATION_EVENT = 'shellui:locationchange';

export type AppLocation = {
  /** Path relative to `basePath`, always starting with `/`. */
  pathname: string;
  search: string;
  hash: string;
  /** `pathname + search + hash`. */
  path: string;
};

function normalizeBase(basePath: string): string {
  const trimmed = basePath.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Strips `basePath` (such as Vite's `import.meta.env.BASE_URL`) from a pathname. */
export function stripBasePath(pathname: string, basePath = '/'): string {
  const base = normalizeBase(basePath);
  if (!base) return pathname || '/';
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname || '/';
}

/** Adds `basePath` in front of an app path. Only same-document paths are accepted. */
export function withBasePath(path: string, basePath = '/'): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('App paths must start with a single "/".');
  }
  return `${normalizeBase(basePath)}${path}`;
}

/**
 * One spelling per route, for comparing URLs: no trailing slash, and an empty or
 * root hash (`#`, `#/`) dropped. Works on paths and absolute URLs.
 */
export function normalizeAppPath(href: string): string {
  const [, path = '', search = '', hash = ''] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href) ?? [];
  const cleanHash = /^#\/?$/.test(hash) ? '' : hash.replace(/(.)\/+$/, '$1');
  return `${path.replace(/\/+$/, '') || '/'}${search}${cleanHash}`;
}

/** Current app location, relative to `basePath`. */
export function readAppLocation(basePath = '/'): AppLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hash: '', path: '/' };
  }
  const { pathname, search, hash } = window.location;
  const relative = stripBasePath(pathname, basePath);
  return { pathname: relative, search, hash, path: `${relative}${search}${hash}` };
}

/**
 * Moves the app to `path` (relative to `basePath`). Embedded, the SDK turns pushState into
 * replaceState so the shell alone owns back and forward, and reports the new URL up.
 */
export function navigateApp(
  path: string,
  options: { basePath?: string; replace?: boolean } = {},
): void {
  if (typeof window === 'undefined') return;
  const next = withBasePath(path, options.basePath);
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;
  if (options.replace) window.history.replaceState(window.history.state, '', next);
  else window.history.pushState(null, '', next);
  window.dispatchEvent(new Event(APP_LOCATION_EVENT));
}

/** Calls `listener` on navigateApp, back, forward and hash changes. Returns the unsubscribe. */
export function subscribeAppLocation(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(APP_LOCATION_EVENT, listener);
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  return () => {
    window.removeEventListener(APP_LOCATION_EVENT, listener);
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
  };
}
