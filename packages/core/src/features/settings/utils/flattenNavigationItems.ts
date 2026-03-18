import type { NavigationGroup, NavigationItem } from '../../config/types';

export const flattenNavigationItems = (
  navigation: (NavigationItem | NavigationGroup)[],
): NavigationItem[] => {
  if (navigation.length === 0) return [];

  return navigation.flatMap((item) => {
    if ('title' in item && 'items' in item) return item.items;
    return [item];
  });
};
