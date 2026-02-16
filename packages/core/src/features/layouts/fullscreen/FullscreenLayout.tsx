import { useMemo, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup } from '../../config/types';
import { flattenNavigationItems } from '../utils';

interface FullscreenLayoutProps {
  title?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

/** Full-width layout with no sidebar or navigation; only content area. Modal, drawer and providers are still active. */
export function FullscreenLayout({ title, navigation }: FullscreenLayoutProps) {
  const location = useLocation();
  const { i18n } = useTranslation();
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

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden bg-background">
      <Outlet />
    </main>
  );
}
