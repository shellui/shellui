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
import { useModal } from '../../modal/ModalContext';
import { useDrawer } from '../../drawer/DrawerContext';
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { CollapsedDesktopTitlebar } from '../chrome/CollapsedDesktopTitlebar';
import {
  isShellUiRootWindow,
  SafeAreaTopbarOffset,
  SafeAreaTopbarStrip,
} from '../chrome/SafeAreaTopbar';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
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

/** Close the mobile sheet when a modal or drawer opens. */
function CloseMobileSidebarOnOverlay() {
  const { setOpenMobile } = useSidebar();
  const { isOpen: modalOpen } = useModal();
  const { isOpen: drawerOpen } = useDrawer();

  useEffect(() => {
    if (modalOpen || drawerOpen) setOpenMobile(false);
  }, [modalOpen, drawerOpen, setOpenMobile]);

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

const SidebarLayoutContent = ({ title, appIcon, navigation }: SidebarLayoutProps) => {
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
  // Nested shell-in-iframe must not repeat the root safe-area top band.
  const showSafeAreaTopbar = isShellUiRootWindow();

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
    <div
      data-shellui-sidebar-layout=""
      className="flex h-full max-h-full flex-col overflow-hidden"
    >
      <SafeAreaTopbarOffset enabled={showSafeAreaTopbar} />
      {/*
        Root shell only (not when nested in an iframe): tablet / desktop band for
        top safe-area, painted with sidebar background. Height is 0 when the inset
        is 0; overflow clips the border so no stray hairline.
      */}
      <SafeAreaTopbarStrip enabled={showSafeAreaTopbar} />
      <SidebarProvider className="min-h-0 flex-1 overflow-hidden">
        <CloseMobileSidebarOnNavigate />
        <CloseMobileSidebarOnOverlay />
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
            title={title}
            appIcon={appIcon}
          />
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/*
            Mobile top chrome: extend the header background into the status-bar band
            so there is no empty strip. Interactive controls stay below the inset via
            padding. Overlays are fixed full-screen and still cover this band.
            Nested iframe shells skip top safe-area — the host already cleared it.
          */}
          <header
            className="relative z-[46] flex shrink-0 items-center gap-0.5 border-b border-border bg-background px-3 select-none md:hidden"
            style={{
              paddingTop: showSafeAreaTopbar
                ? `calc(var(--shellui-safe-area-top) + ${DESKTOP_TITLEBAR_PAD_TOP_PX}px)`
                : DESKTOP_TITLEBAR_PAD_TOP_PX,
              height: showSafeAreaTopbar
                ? `calc(${DESKTOP_TITLEBAR_HEIGHT_PX}px + var(--shellui-safe-area-top))`
                : DESKTOP_TITLEBAR_HEIGHT_PX,
              ...(mobileTrafficInset !== undefined ? { paddingLeft: mobileTrafficInset } : {}),
            }}
            {...(trafficLights
              ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' }
              : {})}
          >
            <SidebarTrigger
              data-shellui-no-drag=""
              className="relative size-8 touch-manipulation text-foreground"
            />
            {isTauriEnv ? <DesktopHistoryButtons /> : null}
          </header>

          {/*
            Fill to the physical bottom — do not pad safe-area here or the iframe
            looks cut off. In-app content (settings, etc.) owns bottom safe insets.
          */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
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
