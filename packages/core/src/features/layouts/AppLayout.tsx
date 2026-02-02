import type { LayoutType, NavigationItem, NavigationGroup } from '../config/types';
import { DefaultLayout } from './DefaultLayout';
import { FullscreenLayout } from './FullscreenLayout';

interface AppLayoutProps {
  layout?: LayoutType;
  title?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

/** Renders the layout based on config.layout: 'sidebar' (default) or 'fullscreen'. */
export function AppLayout({ layout = 'sidebar', title, navigation }: AppLayoutProps) {
  if (layout === 'fullscreen') {
    return <FullscreenLayout title={title} navigation={navigation} />;
  }
  return <DefaultLayout title={title} navigation={navigation} />;
}
