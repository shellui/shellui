import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';

export interface SidebarLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
}
