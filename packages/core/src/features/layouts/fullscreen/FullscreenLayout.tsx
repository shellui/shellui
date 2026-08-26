import { useMemo, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup } from '../../config/types';
import { flattenNavigationItems } from '../utils';
import { ContentDragOverlay } from '../chrome/ContentDragOverlay';
import { DesktopBackButton } from '../chrome/DesktopBackButton';
import { useIsTauriClient, useMacOverlayChrome } from '../chrome/runtime';
import { DESKTOP_TITLEBAR_HEIGHT_PX, MAC_TRAFFIC_LIGHTS_WIDTH_PX } from '../chrome/constants';

interface FullscreenLayoutProps {
  title?: string;
  navigation: (NavigationItem | NavigationGroup)[];
  children?: React.ReactNode;
}

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

/** Full-width layout with no sidebar or navigation; only content area. Modal, drawer and providers are still active. */
export function FullscreenLayout({ title, navigation, children }: FullscreenLayoutProps) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const isTauriEnv = useIsTauriClient();
  const overlay = useMacOverlayChrome();
  const currentLanguage = i18n.language || 'en';
  const navigationItems = useMemo(() => flattenNavigationItems(navigation), [navigation]);

  useEffect(() => {
    if (!title) return;
    const pathname = location.pathname.replace(/^\/+|\/+$/g, '') || '';
    const segment = pathname.split('/')[0];
    if (!segment) {
      document.title = title;
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
    <main className="relative flex flex-col w-full h-screen overflow-hidden bg-background">
      {overlay ? <ContentDragOverlay /> : null}
      {isTauriEnv ? (
        <div
          className="pointer-events-auto absolute top-0 left-0 z-[46] flex items-center"
          style={{
            height: DESKTOP_TITLEBAR_HEIGHT_PX,
            paddingLeft: overlay ? MAC_TRAFFIC_LIGHTS_WIDTH_PX : 8,
          }}
        >
          <DesktopBackButton />
        </div>
      ) : null}
      {children || <Outlet />}
    </main>
  );
}
