import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';

export type SidebarChromeVariant = 'sidebar' | 'inset';

export interface SidebarLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
  /** Visual chrome: default flush sidebar, or inset padded/rounded main frame. */
  variant?: SidebarChromeVariant;
}
