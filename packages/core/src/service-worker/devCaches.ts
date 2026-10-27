/**
 * Cache names for the dev service worker (`shellui start`).
 *
 * Vite serves the shell at the same URLs in every version (`/index.css`,
 * `/main.tsx`, `/features/...`), so the dev worker never caches scripts or
 * styles. Images, fonts and the offline HTML fallback use caches named after
 * the core version, so an upgrade drops the previous ones.
 */
const DEV_CACHE_PREFIX = 'shellui-dev-';

/** Unversioned names written by older dev workers. */
const LEGACY_DEV_CACHES = ['images', 'html-cache', 'static-resources', 'fonts'];

export function devCacheNames(version: string) {
  return {
    images: `${DEV_CACHE_PREFIX}images-${version}`,
    fonts: `${DEV_CACHE_PREFIX}fonts-${version}`,
    html: `${DEV_CACHE_PREFIX}html-${version}`,
  };
}

/** True for a cache an older dev worker left behind. */
export function isStaleDevCache(name: string, version: string): boolean {
  if (LEGACY_DEV_CACHES.includes(name)) return true;
  if (!name.startsWith(DEV_CACHE_PREFIX)) return false;
  return !Object.values(devCacheNames(version)).includes(name);
}
