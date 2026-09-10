import { Outlet } from 'react-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';
import {
  filterNavigationForAuthState,
  filterNavigationByViewport,
  flattenNavigationItems,
  hasLoginNavigationItem,
  resolveLocalizedString,
  splitNavigationByPosition,
} from '../utils';
import { useNavigationItems } from '../../../routes/hooks/useNavigationItems';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSettings } from '../../settings/hooks/useSettings';
import { useViewport } from '../../../hooks/use-viewport';
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { useIsTauriClient, useMacTrafficLights } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from '../chrome/constants';
import { FloatingFadeMask } from './FloatingFadeMask';
import { FloatingTabBar } from './FloatingTabBar';
import { FloatingSidebar } from './FloatingSidebar';
import { useFloatingChrome } from './useFloatingChrome';

export interface FloatingLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation?: (NavigationItem | NavigationGroup)[];
}

/** Adaptive layout: floating glass tabs / sidebar over full-bleed content. */
export function FloatingLayout({ title, appIcon, navigation = [] }: FloatingLayoutProps) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { navigationItem } = useNavigationItems();
  const viewport = useViewport();
  const { chromeVisible, sidebarCollapsed, toggleSidebarCollapsed } = useFloatingChrome(viewport);
  const isTauriEnv = useIsTauriClient();
  const trafficLights = useMacTrafficLights();
  const currentLanguage = i18n.language || 'en';

  const hasCustomLoginNav = useMemo(() => hasLoginNavigationItem(navigation), [navigation]);
  // Same rule as sidebar / app-bar: show account menu when logged in (login nav item is filtered out).
  const showAuthButton = !hasCustomLoginNav || isAuthenticated;

  const authAwareNavigation = useMemo(
    () =>
      filterNavigationForAuthState(navigation, isAuthenticated, settings.developerFeatures.enabled),
    [navigation, isAuthenticated, settings.developerFeatures.enabled],
  );

  const { startNav, endItems } = useMemo(() => {
    const navViewport = viewport === 'mobile' ? 'mobile' : 'desktop';
    const viewportNav = filterNavigationByViewport(authAwareNavigation, navViewport);
    const { start, end } = splitNavigationByPosition(viewportNav);
    return { startNav: start, endItems: end };
  }, [authAwareNavigation, viewport]);

  const tabItems = useMemo(() => flattenNavigationItems(startNav), [startNav]);

  useEffect(() => {
    if (!title) return;
    if (navigationItem) {
      const label = resolveLocalizedString(navigationItem.label, currentLanguage);
      document.title = `${label} | ${title}`;
    } else {
      document.title = title;
    }
  }, [navigationItem, title, currentLanguage]);

  const showTabBar = viewport === 'mobile' || viewport === 'tablet';
  const showSidebar = viewport === 'desktop';
  const showFades = showTabBar;

  return (
    <div
      data-shellui-floating-layout=""
      data-viewport={viewport}
      className="relative flex h-full max-h-full w-full flex-col overflow-hidden bg-background"
    >
      {isTauriEnv ? (
        <div
          className="pointer-events-auto absolute top-0 left-0 z-[46] flex items-center"
          style={{
            height: DESKTOP_TITLEBAR_HEIGHT_PX,
            paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX,
            paddingLeft: trafficLights ? MAC_TRAFFIC_LIGHTS_WIDTH_PX : 8,
          }}
        >
          <DesktopHistoryButtons />
        </div>
      ) : null}

      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {showFades ? (
        <>
          <FloatingFadeMask placement="top" />
          <FloatingFadeMask placement="bottom" />
        </>
      ) : null}

      {showTabBar ? (
        <FloatingTabBar
          items={tabItems}
          endItems={endItems}
          showAuthButton={showAuthButton}
          placement="bottom"
          chromeVisible={chromeVisible}
          viewport={viewport}
        />
      ) : null}

      {showSidebar ? (
        <FloatingSidebar
          title={title}
          appIcon={appIcon}
          navigation={startNav}
          endItems={endItems}
          showAuthButton={showAuthButton}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      ) : null}
    </div>
  );
}
