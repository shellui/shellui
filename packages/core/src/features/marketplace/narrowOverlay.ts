import type { NavigationOverlay } from './overlay';

/**
 * Changes that only take access away. After a save conflict they are applied again on top of
 * the newer layout, because dropping them would hand back access the person just removed.
 * Each returns `null` when the newer layout already has nothing left to remove.
 */

export function overlayWithoutApp(
  overlay: NavigationOverlay,
  appId: string,
  now: string,
): NavigationOverlay | null {
  const existing = overlay.installedApps.find((app) => app.id === appId);
  if (!existing) return null;
  return {
    ...overlay,
    installedApps: overlay.installedApps.filter((app) => app.id !== appId),
    order: overlay.order.filter((path) => path !== existing.path),
    hiddenPaths: overlay.hiddenPaths.filter((path) => path !== existing.path),
    updatedAt: now,
  };
}

/** Keep only the capabilities in `allowed`. Never adds one, so it cannot widen access. */
export function overlayWithCapabilitiesNarrowedTo(
  overlay: NavigationOverlay,
  appId: string,
  allowed: readonly string[],
  now: string,
): NavigationOverlay | null {
  const existing = overlay.installedApps.find((app) => app.id === appId);
  if (!existing) return null;
  const kept = existing.capabilities.filter((capability) => allowed.includes(capability));
  if (kept.length === existing.capabilities.length) return null;
  return {
    ...overlay,
    installedApps: overlay.installedApps.map((app) =>
      app.id === appId ? { ...app, capabilities: kept, updatedAt: now } : app,
    ),
    updatedAt: now,
  };
}

/** True when `next` grants nothing that `current` did not. */
export function onlyNarrowsCapabilities(
  current: readonly string[],
  next: readonly string[],
): boolean {
  return next.every((capability) => current.includes(capability));
}

/** Applies a narrowing change to the newer layout, or returns `null` when it has nothing to do. */
export type NarrowingReapply = (remote: NavigationOverlay) => NavigationOverlay | null;
