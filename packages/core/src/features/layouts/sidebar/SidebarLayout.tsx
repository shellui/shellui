import { Outlet } from 'react-router';
import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import {
  filterNavigationForAuthState,
  filterNavigationByViewport,
  filterNavigationForSidebar,
  flattenNavigationItems,
  hasLoginNavigationItem,
  resolveLocalizedString as resolveLocalizedLabel,
  splitNavigationByPosition,
} from '../utils';
import { SidebarInner } from './SidebarInner';
import { MobileBottomNav } from './MobileBottomNav';
import type { SidebarLayoutProps } from './types';
import { useNavigationItems } from '../../../routes/hooks/useNavigationItems';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSettings } from '../../settings/hooks/useSettings';

const SidebarLayoutContent = ({ title, logo, navigation }: SidebarLayoutProps) => {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { navigationItem, rootItem } = useNavigationItems();

  const currentLanguage = useMemo(() => {
    return i18n.language || 'en';
  }, [i18n]);

  const hasCustomLoginNav = useMemo(() => hasLoginNavigationItem(navigation), [navigation]);
  const authAwareNavigation = useMemo(
    () =>
      filterNavigationForAuthState(navigation, isAuthenticated, settings.developerFeatures.enabled),
    [navigation, isAuthenticated, settings.developerFeatures.enabled],
  );
  const { startNav, endItems, mobileNavItems } = useMemo(() => {
    const desktopNav = filterNavigationByViewport(authAwareNavigation, 'desktop');
    const mobileNav = filterNavigationByViewport(authAwareNavigation, 'mobile');
    const { start, end } = splitNavigationByPosition(desktopNav);
    const mobileFlat = flattenNavigationItems(mobileNav);

    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
      mobileNavItems: mobileFlat,
    };
  }, [authAwareNavigation]);

  useEffect(() => {
    if (!title) return;
    if (navigationItem) {
      const label = resolveLocalizedLabel(navigationItem.label, currentLanguage);
      document.title = `${label} | ${title}`;
    } else {
      document.title = title;
    }
  }, [navigationItem, title, currentLanguage]);

  return (
    <div>
      <div className="flex h-screen overflow-hidden">
        <Sidebar className={cn('hidden md:flex shrink-0')}>
          <SidebarInner
            title={title}
            logo={logo}
            startNav={startNav}
            endItems={endItems}
            showAuthButton={!hasCustomLoginNav || isAuthenticated}
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
        showHomeButton={!rootItem}
      />
    </div>
  );
};

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
