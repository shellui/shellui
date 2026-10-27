/// <reference lib="webworker" />

import { cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { getLogger } from '@shellui/sdk';
import { version as coreVersion } from '../../package.json';
import { devCacheNames, isStaleDevCache } from './devCaches';

const _logger = getLogger('shellcore');

declare const self: ServiceWorkerGlobalScope;

const CACHE = devCacheNames(coreVersion);

// Clean up old caches
cleanupOutdatedCaches();

// In dev mode, we don't precache (no manifest available).
// Scripts, styles and workers always come from the dev server: Vite serves them at
// the same URLs in every version, so a cached copy would show an older shell.

// Cache images with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE.images,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);

// Cache HTML files with NetworkFirst (check for updates first, fallback to cache)
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: CACHE.html,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Cache fonts with CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: CACHE.fonts,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  }),
);

// Skip waiting when the page requests an update, then take control of open clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older dev workers (unversioned names or another core version).
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => isStaleDevCache(name, coreVersion))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
