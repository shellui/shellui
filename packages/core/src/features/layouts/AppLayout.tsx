import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import type { LayoutType, NavigationItem, NavigationGroup, ThemeAsset } from '../config/types';
import { useSettings } from '../settings/SettingsContext';
import { ModalProvider } from '../modal/ModalContext';
import { DrawerProvider } from '../drawer/DrawerContext';
import { OverlayShell } from './OverlayShell';
import { StoragePickerProvider } from '../storage/StoragePickerContext';
import { LayoutFallback } from './LayoutFallback';

const SidebarLayout = lazy(() =>
  import('./sidebar/SidebarLayout').then((m) => ({ default: m.SidebarLayout })),
);
const FullscreenLayout = lazy(() =>
  import('./fullscreen/FullscreenLayout').then((m) => ({ default: m.FullscreenLayout })),
);
const WindowsLayout = lazy(() =>
  import('./windows/WindowsLayout').then((m) => ({ default: m.WindowsLayout })),
);
const AppBarLayout = lazy(() =>
  import('./appbar/AppBarLayout').then((m) => ({ default: m.AppBarLayout })),
);

interface AppLayoutProps {
  layout?: LayoutType;
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation?: (NavigationItem | NavigationGroup)[];
  children?: React.ReactNode;
}

/** Renders the layout based on settings.layout (override) or config.layout: 'sidebar' (default), 'fullscreen', or 'windows'. Lazy-loads only the active layout. */
export function AppLayout({
  layout = 'sidebar',
  title,
  appIcon,
  logo,
  navigation,
  children,
}: AppLayoutProps) {
  const { settings } = useSettings();
  const effectiveLayout: LayoutType = settings.layout ?? layout;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let LayoutComponent: LazyExoticComponent<ComponentType<any>>;
  let layoutProps: Record<string, unknown>;

  if (effectiveLayout === 'fullscreen') {
    LayoutComponent = FullscreenLayout;
    layoutProps = { title, navigation: navigation || [], children };
  } else if (effectiveLayout === 'windows') {
    LayoutComponent = WindowsLayout;
    layoutProps = { title, appIcon, logo, navigation: navigation || [] };
  } else if (effectiveLayout === 'app-bar') {
    LayoutComponent = AppBarLayout;
    layoutProps = { title, appIcon, logo, navigation: navigation || [] };
  } else {
    LayoutComponent = SidebarLayout;
    layoutProps = { title, appIcon, logo, navigation: navigation || [] };
  }
  return (
    <ModalProvider>
      <DrawerProvider>
        <StoragePickerProvider>
          <OverlayShell>
            <Suspense fallback={<LayoutFallback />}>
              {children ? children : <LayoutComponent {...layoutProps} />}
            </Suspense>
          </OverlayShell>
        </StoragePickerProvider>
      </DrawerProvider>
    </ModalProvider>
  );
}
