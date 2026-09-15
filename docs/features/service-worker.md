---
title: Enable the service worker
sidebar_label: Service Worker
description: 'Opt in to production caching and update toasts from Settings → Advanced → Service Worker.'
---

The shell can register a service worker that precaches build assets, uses network-first navigation, and shows update toasts. It is **opt-in**: `settings.serviceWorker.enabled` defaults to `false`. Turn it on in **Settings → Advanced → Service Worker**. Registration also requires a non-empty `navigation` array. Tauri desktop (`--app` / `--target tauri`) unregisters the worker; the desktop wrapper has its own cache.

The CLI still **builds** `sw.js` for web (`shellui build`, and a dev plugin for `shellui start`). Building the file is not the same as registering it.

## User controls

In Settings → Advanced → Service Worker you can:

- Enable or disable registration
- See whether the worker is registered
- Check for updates
- Unregister
- Clear app caches (when the panel exposes it)

Toasts when a new worker is waiting use copy such as "A new version is available. Refresh to update." Users can refresh immediately or wait until the next load. After refresh, a waiting worker activates.

## Caching

| Kind                                            | Strategy                                      |
| ----------------------------------------------- | --------------------------------------------- |
| Precache (HTML, CSS, JS, images from the build) | Cache-first with network fallback, on install |
| Navigation                                      | Network-first with cache fallback             |
| API requests                                    | Network-first (not cached by default)         |

When offline, cached assets and pages can still load. Do not assume background sync or queued writes unless you implement that in your iframe app.

## Troubleshoot registration

Confirm you enabled the toggle, `navigation` is non-empty, you are not in Tauri, and `sw.js` is deployed next to the site. If the worker is stuck, unregister from Settings, refresh, then enable again. In local `shellui start`, HMR is the primary workflow; treat the service worker as a production concern even though `sw.js` may exist in dev.

`config.version` can be shown in Settings → System → Update app so you can tell builds apart.

## Related pages

- [CLI](/cli), [Desktop app](/tauri)
