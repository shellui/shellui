import type { NavigationItem } from '../../config/types';
import { NavIcon } from '../sidebar/SidebarIcons';
import { getExternalFaviconUrl } from '../sidebar/sidebarUtils';

function itemIconSrc(item: NavigationItem): string | null {
  if (item.icon) return item.icon;
  if (item.openIn === 'external') return getExternalFaviconUrl(item.url);
  return null;
}

/** Plain 16px icon for start-nav links and their menus (no tile, like the mock). */
export function AppBarItemIcon({ item }: { item: NavigationItem }) {
  return (
    <NavIcon
      src={itemIconSrc(item)}
      className="size-4"
    />
  );
}
