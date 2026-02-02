import { useMemo } from 'react';
import { Outlet } from 'react-router';
import type { NavigationItem, NavigationGroup } from '../config/types';
import { flattenNavigationItems } from './utils';
import { LayoutProviders } from './LayoutProviders';
import { OverlayShell } from './OverlayShell';

interface FullscreenLayoutProps {
  title?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

/** Full-width layout with no sidebar or navigation; only content area. Modal, drawer and providers are still active. */
export function FullscreenLayout({ navigation }: FullscreenLayoutProps) {
  const navigationItems = useMemo(() => flattenNavigationItems(navigation), [navigation]);

  return (
    <LayoutProviders>
      <OverlayShell navigationItems={navigationItems}>
        <main className="flex flex-col w-full h-screen overflow-hidden bg-background">
          <Outlet />
        </main>
      </OverlayShell>
    </LayoutProviders>
  );
}
