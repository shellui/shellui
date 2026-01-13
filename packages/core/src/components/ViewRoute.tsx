import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';
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
      const pathPrefix = `/${item.path}`;
      return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
    });
  }, [navigation, pathname]);

  if (!navItem) {
    return <Navigate to="/" replace />;
  }
  // Calculate the relative path from the navItem.path
  // e.g. if item.path is "docs" and pathname is "/docs/intro", subPath is "intro"
  const pathPrefix = `/${navItem.path}`;
  const subPath = pathname.length > pathPrefix.length 
    ? pathname.slice(pathPrefix.length + 1) 
    : '';

  // Construct the final URL for the iframe
  let finalUrl = navItem.url;
  if (subPath) {
    const baseUrl = navItem.url.endsWith('/') ? navItem.url : `${navItem.url}/`;
    finalUrl = `${baseUrl}${subPath}`;
  }
  return <ContentView url={finalUrl} pathPrefix={navItem.path} />;
};
