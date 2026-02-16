import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';
import {
  getNavPathPrefix,
  isHashRouterNavItem,
  getBaseUrlWithoutHash,
  getHashPathFromUrl,
} from '../features/layouts/utils';
import { ContentView } from './ContentView';
import type { NavigationItem } from '../features/config/types';

interface ViewRouteProps {
  navigation: NavigationItem[];
}

export const ViewRoute = ({ navigation }: ViewRouteProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  const navItem = useMemo(() => {
    return navigation.find((item) => {
      const pathPrefix = getNavPathPrefix(item);
      return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
    });
  }, [navigation, pathname]);

  // When no nav matches (e.g. /layout on refresh): use root item (path '' or '/') with pathname as hash subpath to avoid 404
  const rootItem = useMemo(
    () => navigation.find((item) => item.path === '' || item.path === '/'),
    [navigation],
  );
  const useRootFallback = !navItem && rootItem && pathname !== '/';
  const actualNavItem = navItem ?? (useRootFallback ? rootItem : null);
  const actualSubPath = useRootFallback
    ? pathname.replace(/^\//, '')
    : actualNavItem
      ? pathname.length > getNavPathPrefix(actualNavItem).length
        ? pathname.slice(getNavPathPrefix(actualNavItem).length + 1)
        : ''
      : '';

  if (!actualNavItem) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }
  const pathPrefix = getNavPathPrefix(actualNavItem);
  const subPath = actualSubPath;

  // Construct the final URL for the iframe (non-hash: base + path; hash app: preserve nav url hash path + subPath)
  let finalUrl: string;
  if (isHashRouterNavItem(actualNavItem)) {
    const base = getBaseUrlWithoutHash(actualNavItem.url).replace(/\/$/, '');
    const navHashPath = getHashPathFromUrl(actualNavItem.url).replace(/^\/+|\/+$/g, '');
    const segments = [navHashPath, subPath].filter(Boolean);
    const fullHashPath = '/' + segments.join('/');
    finalUrl = `${base}#${fullHashPath}`;
  } else {
    finalUrl = actualNavItem.url;
    if (subPath) {
      const baseUrl = actualNavItem.url.endsWith('/') ? actualNavItem.url : `${actualNavItem.url}/`;
      finalUrl = `${baseUrl}${subPath}`;
    }
  }
  return (
    <ContentView
      url={finalUrl}
      pathPrefix={actualNavItem.path}
      navItem={actualNavItem}
    />
  );
};
