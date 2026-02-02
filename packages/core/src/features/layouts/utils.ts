import type { NavigationItem, NavigationGroup } from '../config/types';

/** Flatten navigation items from groups or flat array. */
export function flattenNavigationItems(
  navigation: (NavigationItem | NavigationGroup)[]
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

/** Filter navigation for sidebar: remove hidden items and groups that become empty. */
export function filterNavigationForSidebar(
  navigation: (NavigationItem | NavigationGroup)[]
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

/** Split navigation by position: start (main content) and end (footer). */
export function splitNavigationByPosition(
  navigation: (NavigationItem | NavigationGroup)[]
): { start: (NavigationItem | NavigationGroup)[]; end: NavigationItem[] } {
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
