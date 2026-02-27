import type { NavigationItem, NavigationGroup, LocalizedString } from '../config/types';
import urls from '../../constants/urls';

/** Path prefix for a nav item: "/" for root (path '' or '/'), otherwise "/{path}". */
export function getNavPathPrefix(item: NavigationItem): string {
  return item.path === '' ? '/' : `/${item.path}`;
}

/** Whether a URL string uses hash-based routing (e.g. contains /#/). */
export function isHashRouterUrl(url: string): boolean {
  return url.includes('/#/');
}

/** Whether a nav item uses hash-based routing (explicit flag or inferred from url). */
export function isHashRouterNavItem(item: NavigationItem): boolean {
  if (item.useHashRouter === true) return true;
  if (item.useHashRouter === false) return false;
  return isHashRouterUrl(item.url);
}

/** Base URL without hash (origin + pathname before #). Used to match and build iframe URLs for hash apps. */
export function getBaseUrlWithoutHash(url: string): string {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return url;
  const base = url.slice(0, hashIndex);
  return base.endsWith('/') ? base : `${base}/`;
}

/** Hash path from a URL (part after #), e.g. "/themes" from "http://localhost:5173/#/themes". Returns "" if no hash. */
export function getHashPathFromUrl(url: string): string {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return '';
  const hash = url.slice(hashIndex + 1);
  return hash.startsWith('/') ? hash : `/${hash}`;
}

/** Among items that match the current pathname, return the longest path prefix. Used so only one nav item is active when URLs nest (e.g. /foo and /foo/bar). */
export function getActivePathPrefix(pathname: string, items: NavigationItem[]): string | null {
  const linkItems = items.filter(
    (i) => i.openIn !== 'modal' && i.openIn !== 'drawer' && i.openIn !== 'external',
  );
  const matching = linkItems
    .map((i) => getNavPathPrefix(i))
    .filter((p) => pathname === p || pathname.startsWith(p === '/' ? '/' : `${p}/`));
  if (matching.length === 0) return null;
  return matching.reduce((a, b) => (a.length >= b.length ? a : b));
}

/** Resolve a localized string to a single string for the given language. */
export function resolveLocalizedString(value: LocalizedString | undefined, lang: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

/** Flatten navigation items from groups or flat array. */
export function flattenNavigationItems(
  navigation: (NavigationItem | NavigationGroup)[],
): NavigationItem[] {
  if (navigation.length === 0) {
    return [];
  }
  return navigation.flatMap((item) => {
    if ('title' in item && 'items' in item) {
      return (item as NavigationGroup).items;
    }
    return item as NavigationItem;
  });
}

export type Viewport = 'mobile' | 'desktop';

/** Filter navigation by viewport: remove hidden and viewport-specific hidden items (and empty groups). */
export function filterNavigationByViewport(
  navigation: (NavigationItem | NavigationGroup)[],
  viewport: Viewport,
): (NavigationItem | NavigationGroup)[] {
  if (navigation.length === 0) return [];
  const hideOnMobile = viewport === 'mobile';
  const hideOnDesktop = viewport === 'desktop';
  return navigation
    .map((item) => {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        const visibleItems = group.items.filter((navItem) => {
          if (navItem.hidden) return false;
          if (hideOnMobile && navItem.hiddenOnMobile) return false;
          if (hideOnDesktop && navItem.hiddenOnDesktop) return false;
          return true;
        });
        if (visibleItems.length === 0) return null;
        return { ...group, items: visibleItems };
      }
      const navItem = item as NavigationItem;
      if (navItem.hidden) return null;
      if (hideOnMobile && navItem.hiddenOnMobile) return null;
      if (hideOnDesktop && navItem.hiddenOnDesktop) return null;
      return item;
    })
    .filter((item): item is NavigationItem | NavigationGroup => item !== null);
}

/** Filter navigation for sidebar: remove hidden items and groups that become empty. */
export function filterNavigationForSidebar(
  navigation: (NavigationItem | NavigationGroup)[],
): (NavigationItem | NavigationGroup)[] {
  if (navigation.length === 0) return [];
  return navigation
    .map((item) => {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        const visibleItems = group.items.filter((navItem) => !navItem.hidden);
        if (visibleItems.length === 0) return null;
        return { ...group, items: visibleItems };
      }
      const navItem = item as NavigationItem;
      if (navItem.hidden) return null;
      return item;
    })
    .filter((item): item is NavigationItem | NavigationGroup => item !== null);
}

/** Synthetic homepage nav item: used when there is no root (path '' or '/') in the list, so users can navigate to "/". Reused by app-bar and sidebar mobile. */
export const HOMEPAGE_NAV_ITEM: NavigationItem = {
  path: '/',
  label: { en: 'Home', fr: 'Accueil' },
  url: '/',
};

/** If there is no root item (path '' or '/') in the list, prepend a synthetic Homepage item. Use in app-bar and anywhere that needs a "Home" entry when nav has no "/" path. */
export function withHomepageWhenNoRoot(items: NavigationItem[]): NavigationItem[] {
  const hasRoot = items.some((i) => i.path === '' || i.path === '/');
  if (hasRoot) return items;
  return [HOMEPAGE_NAV_ITEM, ...items];
}

const normalizePathForComparison = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return trimmed.replace(/\/+$/, '') || '/';
  }
};

/** True when a nav item URL points to the built-in login route. */
export function isLoginNavigationUrl(url: string): boolean {
  return normalizePathForComparison(url) === urls.login;
}

/** Whether the config defines at least one navigation item targeting the login route. */
export function hasLoginNavigationItem(navigation: (NavigationItem | NavigationGroup)[]): boolean {
  return flattenNavigationItems(navigation).some((item) => isLoginNavigationUrl(item.url));
}

/**
 * Hide login navigation entries only when authenticated, so custom login entries
 * can still be used while signed out (e.g. open login in modal/drawer).
 */
export function filterNavigationForAuthState(
  navigation: (NavigationItem | NavigationGroup)[],
  isAuthenticated: boolean,
): (NavigationItem | NavigationGroup)[] {
  if (navigation.length === 0) return navigation;
  return navigation
    .map((item) => {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        const visibleItems = group.items.filter((navItem) => {
          if (navItem.hideWhenLoggedOut && !isAuthenticated) return false;
          if (isAuthenticated && isLoginNavigationUrl(navItem.url)) return false;
          return true;
        });
        if (visibleItems.length === 0) return null;
        return { ...group, items: visibleItems };
      }
      const navItem = item as NavigationItem;
      if (navItem.hideWhenLoggedOut && !isAuthenticated) return null;
      if (isAuthenticated && isLoginNavigationUrl(navItem.url)) return null;
      return item;
    })
    .filter((item): item is NavigationItem | NavigationGroup => item !== null);
}

/** Split navigation by position: start (main content) and end (footer). */
export function splitNavigationByPosition(navigation: (NavigationItem | NavigationGroup)[]): {
  start: (NavigationItem | NavigationGroup)[];
  end: NavigationItem[];
} {
  const start: (NavigationItem | NavigationGroup)[] = [];
  const end: NavigationItem[] = [];
  for (const item of navigation) {
    const position = 'position' in item ? (item.position ?? 'start') : 'start';
    if (position === 'end') {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        end.push(...group.items.filter((navItem) => !navItem.hidden));
      } else {
        const navItem = item as NavigationItem;
        if (!navItem.hidden) end.push(navItem);
      }
    } else {
      start.push(item);
    }
  }
  return { start, end };
}
