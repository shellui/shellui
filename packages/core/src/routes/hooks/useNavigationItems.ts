import { useMemo } from 'react';
import { useConfig } from '../../features/config/useConfig';
import { useAuth } from '../../features/auth/hooks/useAuth';
import {
  filterNavigationForAuthState,
  flattenNavigationItems,
  findMatchingNavigationItem,
  getBaseUrlWithoutHash,
  getHashPathFromUrl,
  getNavPathPrefix,
  isHashRouterNavItem,
} from '../../features/layouts/utils';
import { useSettings } from '../../features/settings/hooks/useSettings';
import { useLocation } from 'react-router';

export function useNavigationItems() {
  const { config } = useConfig();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  const navigationItems = useMemo(() => {
    const authAndDevFilteredNavigation = filterNavigationForAuthState(
      config?.navigation ?? [],
      isAuthenticated,
      settings.developerFeatures.enabled,
    );
    return flattenNavigationItems(authAndDevFilteredNavigation);
  }, [config?.navigation, isAuthenticated, settings.developerFeatures.enabled]);

  const navigationItem = useMemo(
    () => findMatchingNavigationItem(navigationItems, location.pathname),
    [navigationItems, location.pathname],
  );

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
    if (!navigationItem) {
      return '';
    }

    const pathPrefix = getNavPathPrefix(navigationItem);
    const subPath =
      location.pathname.length > pathPrefix.length
        ? location.pathname.slice(pathPrefix.length).replace(/^\//, '')
        : '';

    // Construct the final URL for the iframe (non-hash: base + path; hash app: preserve nav url hash path + subPath)
    if (isHashRouterNavItem(navigationItem)) {
      const base = getBaseUrlWithoutHash(navigationItem.url).replace(/\/$/, '');
      const navHashPath = getHashPathFromUrl(navigationItem.url).replace(/^\/+|\/+$/g, '');
      const segments = [navHashPath, subPath].filter(Boolean);
      const fullHashPath = `/${segments.join('/')}`;
      return `${base}#${fullHashPath}`;
    }

    let finalUrl = navigationItem.url;
    if (subPath) {
      const baseUrl = navigationItem.url.endsWith('/')
        ? navigationItem.url
        : `${navigationItem.url}/`;
      finalUrl = `${baseUrl}${subPath}`;
    }
    return finalUrl;
  }, [navigationItem, location.pathname]);

  return {
    url,
    rootItem,
    currentItem: navigationItem,
    navigationItem,
    navigationItems,
  };
}
