import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';
import { getNavPathPrefix, getEffectiveUrl } from '../features/layouts/utils';
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

  if (!navItem) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }
  // Calculate the relative path from the navItem.path
  // e.g. if item.path is "docs" and pathname is "/docs/intro", subPath is "intro"
  const pathPrefix = getNavPathPrefix(navItem);
  const subPath = pathname.length > pathPrefix.length ? pathname.slice(pathPrefix.length + 1) : '';

  // Effective URL: url string or app-path URL when item uses a component
  const baseUrl = getEffectiveUrl(navItem);
  let finalUrl = baseUrl;
  if (!navItem.component && subPath && navItem.url) {
    const base = navItem.url.endsWith('/') ? navItem.url : `${navItem.url}/`;
    finalUrl = `${base}${subPath}`;
  }

  return (
    <ContentView
      url={finalUrl}
      baseUrl={baseUrl}
      pathPrefix={navItem.path}
      navItem={navItem}
    />
  );
};
