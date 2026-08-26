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
import { DesktopBackButton } from '../chrome/DesktopBackButton';
import { CollapsedDesktopTitlebar } from '../chrome/CollapsedDesktopTitlebar';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
  DESKTOP_TITLEBAR_HEIGHT_PX,
} from '../chrome/constants';

/** Close the mobile sheet when the route changes. */
function CloseMobileSidebarOnNavigate() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  return null;
}

/** Sync collapsed-titlebar layout offset onto <html> for CSS. */
function CollapsedTitlebarOffset() {
  const overlay = useMacOverlayChrome();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  useEffect(() => {
    const root = document.documentElement;
    if (overlay && collapsed) root.setAttribute('data-shellui-collapsed-titlebar', '');
    else root.removeAttribute('data-shellui-collapsed-titlebar');
    return () => root.removeAttribute('data-shellui-collapsed-titlebar');
  }, [overlay, collapsed]);

  return null;
}

const SidebarLayoutContent = ({ title, navigation }: SidebarLayoutProps) => {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { navigationItem } = useNavigationItems();
  const isMobile = useIsMobile();
  const isTauriEnv = useIsTauriClient();
  const trafficLights = useMacTrafficLights();
  const mobileTrafficInset = trafficLights
    ? MAC_TRAFFIC_LIGHTS_WIDTH_PX + MAC_TRAFFIC_LIGHTS_GAP_PX
    : undefined;

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

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <CloseMobileSidebarOnNavigate />
      <CollapsedTitlebarOffset />
      <CollapsedDesktopTitlebar />
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
        <header
          className="relative z-[46] flex shrink-0 items-center gap-0.5 border-b border-border bg-background px-3 select-none md:hidden"
          style={{
            height: DESKTOP_TITLEBAR_HEIGHT_PX,
            ...(mobileTrafficInset != null ? { paddingLeft: mobileTrafficInset } : {}),
          }}
          {...(trafficLights
            ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' }
            : {})}
        >
          <SidebarTrigger
            data-shellui-no-drag=""
            className="relative size-8 touch-manipulation text-foreground"
          />
          {isTauriEnv ? <DesktopBackButton /> : null}
        </header>

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
