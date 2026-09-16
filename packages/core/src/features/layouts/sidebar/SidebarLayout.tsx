import { Outlet, useLocation } from 'react-router';
import { useMemo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
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
import { useScrollHideChrome } from '../chrome/useScrollHideChrome';
import { InsetMobileRadiusOverlay } from '../chrome/InsetMobileRadiusOverlay';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
} from '../chrome/constants';
import { WindowTitleBarActions } from '../../chromeActions';
import { cn } from '../../../lib/utils';

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

const SidebarLayoutContent = ({
  title,
  appIcon,
  navigation,
  variant = 'sidebar',
}: SidebarLayoutProps) => {
  const { i18n } = useTranslation();
  const location = useLocation();
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
  const scrollHideLayout = variant === 'inset' ? 'sidebar-inset' : 'sidebar';
  const { chromeVisible } = useScrollHideChrome({
    enabled: isMobile,
    layout: scrollHideLayout,
    includeSafeArea: showSafeAreaTopbar,
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const [frameUuid, setFrameUuid] = useState<string | null>(null);

  // Bind title-bar actions to the main content iframe (mobile only).
  useEffect(() => {
    if (!isMobile) {
      setFrameUuid(null);
      return;
    }
    const sync = () => {
      const iframe = contentRef.current?.querySelector('iframe');
      if (!iframe) {
        setFrameUuid(null);
        return;
      }
      setFrameUuid(shellui.getUuidByIframe(iframe.contentWindow) ?? null);
    };
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, [isMobile, location.pathname]);

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
      data-shellui-layout-variant={variant}
      className={cn(
        'flex h-full max-h-full flex-col overflow-hidden',
        // Inset chrome: darkened tray so the main frame (and in-app sidebars) separate cleanly.
        variant === 'inset' && 'bg-shellui-inset-chrome',
      )}
    >
      <SafeAreaTopbarOffset enabled={showSafeAreaTopbar} />
      {/*
        Root shell only (not when nested in an iframe): tablet / desktop band for
        top safe-area, painted with sidebar background. Height is 0 when the inset
        is 0; overflow clips the border so no stray hairline.
      */}
      <SafeAreaTopbarStrip
        enabled={showSafeAreaTopbar}
        className={
          variant === 'inset'
            ? '[&>div]:border-transparent [&>div]:bg-shellui-inset-chrome'
            : undefined
        }
      />
      <SidebarProvider className="min-h-0 flex-1 overflow-hidden">
        <CloseMobileSidebarOnNavigate />
        <CloseMobileSidebarOnOverlay />
        <CollapsedTitlebarOffset />
        <CollapsedDesktopTitlebar />
        <Sidebar
          collapsible="icon"
          variant={variant}
          className="border-sidebar-border"
        >
          <SidebarInner
            startNav={startNav}
            endItems={endItems}
            showAuthButton={!hasCustomLoginNav || isAuthenticated}
            title={title}
            appIcon={appIcon}
          />
          {variant !== 'inset' ? <SidebarRail /> : null}
        </Sidebar>

        <SidebarInset
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            // Mobile inset: keep the darkened chrome tray behind the header + card radius.
            variant === 'inset' && 'max-md:bg-transparent',
          )}
        >
          {variant === 'inset' ? <SidebarRail placement="inset" /> : null}{' '}
          {/*
            Mobile: header + inset tray/radius slide as one stack; action row follows
            the same CSS var. Stable inset-top — no jump when chrome hides.
          */}
          <div
            data-shellui-mobile-chrome-stack=""
            data-chrome-visible={chromeVisible ? 'true' : 'false'}
            className="pointer-events-none absolute inset-0 z-[45] md:hidden"
          >
            <header
              data-shellui-scroll-hide-header=""
              className={cn(
                'pointer-events-auto relative z-[1] flex items-center gap-0.5 px-3 select-none',
                variant === 'inset'
                  ? 'border-transparent bg-transparent text-sidebar-foreground'
                  : 'border-b border-border bg-background',
              )}
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
                className="relative size-8 shrink-0 touch-manipulation text-foreground"
              />
              {isTauriEnv ? <DesktopHistoryButtons /> : null}
              {isMobile ? (
                <div
                  data-shellui-no-drag=""
                  className="flex min-w-0 flex-1 items-center"
                >
                  <WindowTitleBarActions frameUuid={frameUuid} />
                </div>
              ) : null}
            </header>
            {variant === 'inset' ? <InsetMobileRadiusOverlay /> : null}
          </div>
          <div
            ref={contentRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export function SidebarLayout({
  title,
  appIcon,
  logo,
  navigation,
  variant = 'sidebar',
}: SidebarLayoutProps) {
  return (
    <SidebarLayoutContent
      title={title}
      appIcon={appIcon}
      logo={logo}
      navigation={navigation}
      variant={variant}
    />
  );
}
