import { Outlet, useLocation } from 'react-router';
import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '../../../components/ui/sidebar';
import {
  filterNavigationForAuthState,
  filterNavigationByViewport,
  filterNavigationForSidebar,
  hasLoginNavigationItem,
  resolveLocalizedString as resolveLocalizedLabel,
  splitNavigationByPosition,
} from '../utils';
import { SidebarInner } from './SidebarInner';
import type { SidebarLayoutProps } from './types';
import { useNavigationItems } from '../../../routes/hooks/useNavigationItems';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSettings } from '../../settings/hooks/useSettings';
import { useIsMobile } from '../../../hooks/use-mobile';
import { ContentDragOverlay } from '../chrome/ContentDragOverlay';
import { DesktopBackButton } from '../chrome/DesktopBackButton';
import { useIsTauriClient, useMacOverlayChrome } from '../chrome/runtime';

/** Close the mobile sheet when the route changes. */
function CloseMobileSidebarOnNavigate() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  return null;
}

const SidebarLayoutContent = ({ title, navigation }: SidebarLayoutProps) => {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { navigationItem } = useNavigationItems();
  const isMobile = useIsMobile();
  const isTauriEnv = useIsTauriClient();
  const overlay = useMacOverlayChrome();

  const currentLanguage = useMemo(() => {
    return i18n.language || 'en';
  }, [i18n]);

  const hasCustomLoginNav = useMemo(() => hasLoginNavigationItem(navigation), [navigation]);
  const authAwareNavigation = useMemo(
    () =>
      filterNavigationForAuthState(navigation, isAuthenticated, settings.developerFeatures.enabled),
    [navigation, isAuthenticated, settings.developerFeatures.enabled],
  );
  const { startNav, endItems } = useMemo(() => {
    const viewportNav = filterNavigationByViewport(
      authAwareNavigation,
      isMobile ? 'mobile' : 'desktop',
    );
    const { start, end } = splitNavigationByPosition(viewportNav);

    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
    };
  }, [authAwareNavigation, isMobile]);

  useEffect(() => {
    if (!title) return;
    if (navigationItem) {
      const label = resolveLocalizedLabel(navigationItem.label, currentLanguage);
      document.title = `${label} | ${title}`;
    } else {
      document.title = title;
    }
  }, [navigationItem, title, currentLanguage]);

  useEffect(() => {
    const root = document.documentElement;
    if (overlay) root.setAttribute('data-shellui-overlay-chrome', '');
    else root.removeAttribute('data-shellui-overlay-chrome');
    if (isTauriEnv) root.setAttribute('data-shellui-tauri', '');
    else root.removeAttribute('data-shellui-tauri');
    return () => {
      root.removeAttribute('data-shellui-overlay-chrome');
      root.removeAttribute('data-shellui-tauri');
    };
  }, [overlay, isTauriEnv]);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <CloseMobileSidebarOnNavigate />
      <Sidebar
        collapsible="icon"
        className="border-sidebar-border"
      >
        <SidebarInner
          startNav={startNav}
          endItems={endItems}
          showAuthButton={!hasCustomLoginNav || isAuthenticated}
        />
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="relative min-w-0 overflow-hidden">
        <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 select-none md:hidden">
          {isTauriEnv ? <DesktopBackButton /> : null}
          <SidebarTrigger className="relative size-9 touch-manipulation text-foreground" />
        </header>

        {overlay ? <ContentDragOverlay /> : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
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
