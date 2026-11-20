import type { NavigationGroup, NavigationItem } from '../config/types';
import { MARKETPLACE_NAV_LABEL, MARKETPLACE_NAV_PATH } from './normalizeMarketplaceConfig';
import type { InstalledAppRecord, NavigationOverlay } from './overlay';
import { isUnsafeNavIconSrc } from './icons';

export function createMarketplaceNavigationItem(url: string): NavigationItem {
  return {
    label: MARKETPLACE_NAV_LABEL,
    path: MARKETPLACE_NAV_PATH,
    url,
    locked: true,
  };
}

export type NavigationEntry = NavigationItem | NavigationGroup;

function isGroup(entry: NavigationEntry): entry is NavigationGroup {
  return 'items' in entry && Array.isArray(entry.items);
}

function cloneNavigation(navigation: readonly NavigationEntry[]): NavigationEntry[] {
  return JSON.parse(JSON.stringify(navigation)) as NavigationEntry[];
}

function itemPaths(entry: NavigationEntry): string[] {
  if (isGroup(entry)) return entry.items.map((item) => item.path);
  return [entry.path];
}

function applyHidden(item: NavigationItem, hiddenPaths: ReadonlySet<string>): NavigationItem {
  if (item.locked) {
    if (item.hidden && hiddenPaths.has(item.path)) {
      const next = { ...item };
      delete next.hidden;
      return next;
    }
    return item;
  }
  if (!hiddenPaths.has(item.path)) return item;
  return { ...item, hidden: true };
}

function rankOf(entry: NavigationEntry, order: ReadonlyMap<string, number>): number {
  const ranks = itemPaths(entry)
    .map((path) => order.get(path))
    .filter((rank): rank is number => rank !== undefined);
  if (ranks.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...ranks);
}

function sortEntries(entries: NavigationEntry[], order: readonly string[]): NavigationEntry[] {
  const index = new Map(order.map((path, position) => [path, position]));
  return entries
    .map((entry, original) => ({ entry, original, rank: rankOf(entry, index) }))
    .sort((a, b) => a.rank - b.rank || a.original - b.original)
    .map((row) => row.entry);
}

export function installedAppNavigationItem(app: InstalledAppRecord): NavigationItem {
  const icon = app.icon && !isUnsafeNavIconSrc(app.icon) ? app.icon : undefined;
  return {
    label: app.name,
    path: app.path,
    url: app.url,
    ...(icon ? { icon } : {}),
  };
}

/**
 * Merge build-time navigation with a runtime overlay.
 * Locked items stay visible. Installed apps never receive `safeForAuthToken` or `childFrames`.
 * The marketplace route is appended when that path is still free.
 */
export function mergeNavigationOverlay(
  navigation: readonly NavigationEntry[] | undefined,
  overlay: NavigationOverlay | null | undefined,
  marketplaceItem?: NavigationItem | null,
): NavigationEntry[] {
  const base = cloneNavigation(navigation ?? []);
  const hidden = new Set(overlay?.hiddenPaths ?? []);
  const staticPaths = new Set<string>();

  const withHidden = base.map((entry) => {
    if (isGroup(entry)) {
      const items = entry.items.map((item) => {
        staticPaths.add(item.path);
        return applyHidden(item, hidden);
      });
      return { ...entry, items };
    }
    staticPaths.add(entry.path);
    return applyHidden(entry, hidden);
  });

  if (marketplaceItem && !staticPaths.has(marketplaceItem.path)) {
    withHidden.push({ ...marketplaceItem, locked: true });
    staticPaths.add(marketplaceItem.path);
  }

  for (const app of overlay?.installedApps ?? []) {
    if (!app.path || staticPaths.has(app.path)) continue;
    withHidden.push(installedAppNavigationItem(app));
    staticPaths.add(app.path);
  }

  return sortEntries(withHidden, overlay?.order ?? []);
}
