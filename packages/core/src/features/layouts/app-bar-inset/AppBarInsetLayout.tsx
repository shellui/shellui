import { AppBarLayout } from '../appbar/AppBarLayout';
import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';

interface AppBarInsetLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
}

/**
 * App-bar inset layout — same as app-bar, with a padded, rounded main frame that
 * reveals the chrome background around the content area (desktop).
 */
export function AppBarInsetLayout(props: AppBarInsetLayoutProps) {
  return (
    <AppBarLayout
      {...props}
      variant="inset"
    />
  );
}
