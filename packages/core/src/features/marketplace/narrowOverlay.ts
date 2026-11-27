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

const PENDING_KEY = 'shellui.navigation.pendingRemovals';

function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isRemoval(value: unknown): value is PendingRemoval {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.appId !== 'string') return false;
  if (item.kind === 'uninstall') return true;
  return (
    item.kind === 'revoke' &&
    Array.isArray(item.capabilities) &&
    item.capabilities.every((c) => typeof c === 'string')
  );
}

/**
 * Pending removals of one user and company, kept in this tab's sessionStorage so a page reload
 * after "NOT saved" does not hand the access back. Another account never sees them.
 */
export function readPendingRemovals(scope: string): PendingRemoval[] {
  try {
    const parsed = JSON.parse(tabStorage()?.getItem(`${PENDING_KEY}:${scope}`) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRemoval) : [];
  } catch {
    return [];
  }
}

export function writePendingRemovals(scope: string, removals: readonly PendingRemoval[]): void {
  try {
    const key = `${PENDING_KEY}:${scope}`;
    if (removals.length) tabStorage()?.setItem(key, JSON.stringify(removals));
    else tabStorage()?.removeItem(key);
  } catch {
    // Storage full or blocked: the removals still apply for as long as this page is open.
  }
}
