import { Outlet, useLocation } from 'react-router';
import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar, SidebarProvider } from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import {
  filterNavigationByViewport,
  filterNavigationForSidebar,
  flattenNavigationItems,
  resolveLocalizedString as resolveLocalizedLabel,
  splitNavigationByPosition,
} from '../utils';
import { SidebarInner } from './SidebarInner';
import { MobileBottomNav } from './MobileBottomNav';
import type { SidebarLayoutProps } from './types';

function SidebarLayoutContent({ title, logo, navigation }: SidebarLayoutProps) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  const { startNav, endItems, navigationItems, mobileNavItems, hasRootNavItem } = useMemo(() => {
    const desktopNav = filterNavigationByViewport(navigation, 'desktop');
    const mobileNav = filterNavigationByViewport(navigation, 'mobile');
    const { start, end } = splitNavigationByPosition(desktopNav);
    const flat = flattenNavigationItems(desktopNav);
    const mobileFlat = flattenNavigationItems(mobileNav);
    const hasRoot = flat.some((item) => item.path === '' || item.path === '/');
    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
      navigationItems: flat,
      mobileNavItems: mobileFlat,
      hasRootNavItem: hasRoot,
    };
  }, [navigation]);

  useEffect(() => {
    if (!title) return;
    const pathname = location.pathname.replace(/^\/+|\/+$/g, '') || '';
    const segment = pathname.split('/')[0];
    if (!segment) {
      const rootNavItem = navigationItems.find((item) => item.path === '' || item.path === '/');
      document.title = rootNavItem
        ? `${resolveLocalizedLabel(rootNavItem.label, currentLanguage)} | ${title}`
        : title;
      return;
    }
    const navItem = navigationItems.find((item) => item.path === segment);
    if (navItem) {
      const label = resolveLocalizedLabel(navItem.label, currentLanguage);
      document.title = `${label} | ${title}`;
    } else {
      document.title = title;
    }
  }, [location.pathname, title, navigationItems, currentLanguage]);

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar className={cn('hidden md:flex shrink-0')}>
          <SidebarInner
            title={title}
            logo={logo}
            startNav={startNav}
            endItems={endItems}
          />
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden bg-background relative min-w-0">
          <div className="flex-1 flex flex-col overflow-auto pb-16 md:pb-0">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav
        items={mobileNavItems}
        currentLanguage={currentLanguage}
        showHomeButton={!hasRootNavItem}
      />
    </SidebarProvider>
  );
}

export function SidebarLayout({ title, appIcon, logo, navigation }: SidebarLayoutProps) {
  return (
    <SidebarLayoutContent
      title={title}
      appIcon={appIcon}
      logo={logo}
      navigation={navigation}
    />
  );
}
