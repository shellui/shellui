/// <reference lib="webworker" />

import { cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { getLogger } from '@shellui/sdk';

const logger = getLogger('shellcore');

declare const self: ServiceWorkerGlobalScope;

// Clean up old caches
cleanupOutdatedCaches();

// In dev mode, we don't precache (no manifest available)
// But we can still cache resources on-demand

// Cache images with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache HTML files with NetworkFirst (check for updates first, fallback to cache)
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'html-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache CSS and JS files with StaleWhileRevalidate
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache fonts with CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// Skip waiting and claim clients immediately when a new service worker is installed
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
