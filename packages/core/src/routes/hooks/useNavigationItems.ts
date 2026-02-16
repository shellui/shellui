import { useMemo } from 'react';
import { useConfig } from '../../features/config/useConfig';
import {
  flattenNavigationItems,
  getBaseUrlWithoutHash,
  getHashPathFromUrl,
  getNavPathPrefix,
  isHashRouterNavItem,
} from '../../features/layouts/utils';
import { useLocation } from 'react-router';

export function useNavigationItems() {
  const { config } = useConfig();
  const location = useLocation();

  const navigationItems = useMemo(() => {
    return flattenNavigationItems(config?.navigation ?? []);
  }, [config]);

  const navigationItem = useMemo(() => {
    return navigationItems.find((item) => {
      const pathPrefix = getNavPathPrefix(item);
      return location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
    });
  }, [navigationItems, location.pathname]);

  // When no nav matches (e.g. /layout on refresh): use root item (path '' or '/') with pathname as hash subpath to avoid 404
  const rootItem = useMemo(
    () => navigationItems.find((item) => item.path === '' || item.path === '/'),
    [navigationItems],
  );

  /**
   * Constructs the final URL for the iframe based on the navigation item and the pathname.
   * If the navigation item is a hash router item, it preserves the hash path and appends the subpath.
   * If the navigation item is not a hash router item, it appends the subpath to the base URL.
   * If the navigation item is not found, it returns an empty string.
   */
  const url = useMemo(() => {
    const pathname = location.pathname;

    const useRootFallback = !navigationItem && rootItem && pathname !== '/';
    const actualNavItem = navigationItem ?? (useRootFallback ? rootItem : null);

    if (!actualNavItem) {
      return '';
    }
    const actualSubPath = useRootFallback
      ? pathname.replace(/^\//, '')
      : actualNavItem
        ? pathname.length > getNavPathPrefix(actualNavItem).length
          ? pathname.slice(getNavPathPrefix(actualNavItem).length + 1)
          : ''
        : '';

    const subPath = actualSubPath;
    // Construct the final URL for the iframe (non-hash: base + path; hash app: preserve nav url hash path + subPath)
    let finalUrl: string;
    if (isHashRouterNavItem(actualNavItem)) {
      const base = getBaseUrlWithoutHash(actualNavItem.url).replace(/\/$/, '');
      const navHashPath = getHashPathFromUrl(actualNavItem.url).replace(/^\/+|\/+$/g, '');
      const segments = [navHashPath, subPath].filter(Boolean);
      const fullHashPath = `/${segments.join('/')}`;
      finalUrl = `${base}#${fullHashPath}`;
    } else {
      finalUrl = actualNavItem.url;
      if (subPath) {
        const baseUrl = actualNavItem.url.endsWith('/')
          ? actualNavItem.url
          : `${actualNavItem.url}/`;
        finalUrl = `${baseUrl}${subPath}`;
      }
    }
    return finalUrl;
  }, [navigationItem, rootItem, location.pathname]);

  return {
    url: url,
    rootItem: rootItem,
    currentItem: navigationItem || rootItem,
    navigationItem: navigationItem || rootItem,
    navigationItems: navigationItems,
  };
}
