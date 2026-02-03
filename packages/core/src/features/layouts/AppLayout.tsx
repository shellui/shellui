import { lazy, Suspense } from 'react';
import type { LayoutType, NavigationItem, NavigationGroup } from '../config/types';

const DefaultLayout = lazy(() => import('./DefaultLayout').then((m) => ({ default: m.DefaultLayout })));
const FullscreenLayout = lazy(() => import('./FullscreenLayout').then((m) => ({ default: m.FullscreenLayout })));
const WindowsLayout = lazy(() => import('./WindowsLayout').then((m) => ({ default: m.WindowsLayout })));

interface AppLayoutProps {
  layout?: LayoutType;
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

function LayoutFallback() {
  return <div className="min-h-screen bg-background" aria-hidden />;
}

/** Renders the layout based on config.layout: 'sidebar' (default), 'fullscreen', or 'windows'. Lazy-loads only the active layout. */
export function AppLayout({ layout = 'sidebar', title, appIcon, logo, navigation }: AppLayoutProps) {
  let LayoutComponent: React.LazyExoticComponent<React.ComponentType<any>>;
  let layoutProps: Record<string, unknown>;

  if (layout === 'fullscreen') {
    LayoutComponent = FullscreenLayout;
    layoutProps = { title, navigation };
  } else if (layout === 'windows') {
    LayoutComponent = WindowsLayout;
    layoutProps = { title, appIcon, logo, navigation };
  } else {
    LayoutComponent = DefaultLayout;
    layoutProps = { title, appIcon, logo, navigation };
  }

  return (
    <Suspense fallback={<LayoutFallback />}>
      <LayoutComponent {...layoutProps} />
    </Suspense>
  );
}
