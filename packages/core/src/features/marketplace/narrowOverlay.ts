import type { NavigationOverlay } from './overlay';

/**
 * A change on this device that takes access away and is not saved yet. Until a save that
 * includes it succeeds, it is applied to every layout the shell commits, including a newer
 * layout loaded after a save conflict, so no conflict or concurrent edit can hand access back.
 */
export type PendingRemoval =
  | { kind: 'uninstall'; appId: string }
  | { kind: 'revoke'; appId: string; capabilities: readonly string[] };

/** Capabilities every installed app keeps. A revoke never lists them. */
const BASELINE = new Set(['theme', 'locale']);

/** The capabilities in `current` that `next` drops. Empty when nothing is taken away. */
export function revokedCapabilities(current: readonly string[], next: readonly string[]): string[] {
  return current.filter((capability) => !BASELINE.has(capability) && !next.includes(capability));
}

/**
 * Apply each pending removal. Only what this device removed is taken out, so a capability or
 * app the other device added stays.
 */
export function applyPendingRemovals(
  overlay: NavigationOverlay,
  removals: readonly PendingRemoval[],
): NavigationOverlay {
  let result = overlay;
  for (const removal of removals) {
    const existing = result.installedApps.find((app) => app.id === removal.appId);
    if (!existing) continue;
    if (removal.kind === 'uninstall') {
      result = {
        ...result,
        installedApps: result.installedApps.filter((app) => app.id !== removal.appId),
        order: result.order.filter((path) => path !== existing.path),
        hiddenPaths: result.hiddenPaths.filter((path) => path !== existing.path),
      };
      continue;
    }
    const kept = existing.capabilities.filter((c) => !removal.capabilities.includes(c));
    if (kept.length === existing.capabilities.length) continue;
    result = {
      ...result,
      installedApps: result.installedApps.map((app) =>
        app.id === removal.appId ? { ...app, capabilities: kept } : app,
      ),
    };
  }
  return result;
}

/**
 * Drop pending removals that a later choice on this device undid: granting a capability again,
 * or installing the app again.
 */
export function withoutUndoneRemovals(
  removals: readonly PendingRemoval[],
  appId: string,
  granted: readonly string[] | 'reinstall',
): PendingRemoval[] {
  return removals.flatMap((removal): PendingRemoval[] => {
    if (removal.appId !== appId) return [removal];
    if (granted === 'reinstall') return [];
    if (removal.kind === 'uninstall') return [removal];
    const capabilities = removal.capabilities.filter((c) => !granted.includes(c));
    return capabilities.length ? [{ ...removal, capabilities }] : [];
  });
}
