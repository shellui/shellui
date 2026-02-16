import type { NavigationItem, NavigationGroup, LocalizedString } from '../config/types';

/** Path prefix for a nav item: "/" for root (path '' or '/'), otherwise "/{path}". */
export function getNavPathPrefix(item: NavigationItem): string {
  return item.path === '/' || item.path === '' ? '/' : `/${item.path}`;
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
