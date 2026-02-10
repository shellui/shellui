import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import type { LayoutType, NavigationItem, NavigationGroup } from '../config/types';
import { useSettings } from '../settings/SettingsContext';

const DefaultLayout = lazy(() =>
  import('./DefaultLayout').then((m) => ({ default: m.DefaultLayout })),
);
const FullscreenLayout = lazy(() =>
  import('./FullscreenLayout').then((m) => ({ default: m.FullscreenLayout })),
);
const WindowsLayout = lazy(() =>
  import('./WindowsLayout').then((m) => ({ default: m.WindowsLayout })),
);
const AppBarLayout = lazy(() =>
  import('./AppBarLayout').then((m) => ({ default: m.AppBarLayout })),
);

interface AppLayoutProps {
  layout?: LayoutType;
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

function LayoutFallback() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-hidden
    />
  );
}

/** Renders the layout based on settings.layout (override) or config.layout: 'sidebar' (default), 'fullscreen', or 'windows'. Lazy-loads only the active layout. */
export function AppLayout({
  layout = 'sidebar',
  title,
  appIcon,
  logo,
  navigation,
}: AppLayoutProps) {
  const { settings } = useSettings();
  const effectiveLayout: LayoutType = settings.layout ?? layout;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let LayoutComponent: LazyExoticComponent<ComponentType<any>>;
  let layoutProps: Record<string, unknown>;

  if (effectiveLayout === 'fullscreen') {
    LayoutComponent = FullscreenLayout;
    layoutProps = { title, navigation };
  } else if (effectiveLayout === 'windows') {
    LayoutComponent = WindowsLayout;
    layoutProps = { title, appIcon, logo, navigation };
  } else if (effectiveLayout === 'app-bar') {
    LayoutComponent = AppBarLayout;
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
