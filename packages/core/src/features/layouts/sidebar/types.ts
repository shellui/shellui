import type { NavigationItem, NavigationGroup } from '../../config/types';

export interface SidebarLayoutProps {
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}
