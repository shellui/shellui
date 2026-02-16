import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import type { LayoutType, NavigationItem, NavigationGroup } from '../config/types';
import { useSettings } from '../settings/SettingsContext';
import { SonnerProvider } from '../sonner/SonnerContext';
import { ModalProvider } from '../modal/ModalContext';
import { DrawerProvider } from '../drawer/DrawerContext';
import { useNavigationItems } from '../../routes/hooks/useNavigationItems';
import { OverlayShell } from './OverlayShell';

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
  const { navigationItems } = useNavigationItems();
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
    LayoutComponent = SidebarLayout;
    layoutProps = { title, appIcon, logo, navigation };
  }

  return (
    <ModalProvider>
      <DrawerProvider>
        <SonnerProvider>
          <OverlayShell navigationItems={navigationItems}>
            <Suspense fallback={<LayoutFallback />}>
              <LayoutComponent {...layoutProps} />
            </Suspense>
          </OverlayShell>
        </SonnerProvider>
      </DrawerProvider>
    </ModalProvider>
  );
}
