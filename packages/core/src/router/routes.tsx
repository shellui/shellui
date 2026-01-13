import type { RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { HomeView } from '../components/HomeView';
import { SettingsView } from '../components/SettingsView';
import { ViewRoute } from '../components/ViewRoute';
import { DefaultLayout } from '../features/layouts/DefaultLayout';
import { Navigate } from 'react-router';

export const createRoutes = (config: ShellUIConfig): RouteObject[] => {
  const routes: RouteObject[] = [];

  // Settings route (if configured)
  if (config.settingsUrl) {
    const settingsPath = extractPathFromUrl(config.settingsUrl);
    if (settingsPath) {
      routes.push({
        path: settingsPath,
        element: <SettingsView />,
      });
    }
  }

  // Main layout route with nested routes
  const layoutRoute: RouteObject = {
    element: (
      <DefaultLayout 
        title={config.title} 
        navigation={config.navigation || []}
        settingsUrl={config.settingsUrl}
      />
    ),
    children: [
      {
        path: '/',
        element: <HomeView />,
      },
    ],
  };

  // Add navigation routes
  if (config.navigation && config.navigation.length > 0) {
    config.navigation.forEach((item) => {
      layoutRoute.children!.push({
        path: `/${item.path}/*`,
        element: <ViewRoute navigation={config.navigation || []} />,
      });
    });
  }

  // Catch-all route
  layoutRoute.children!.push({
    path: '*',
    element: <Navigate to="/" replace />,
  });

  routes.push(layoutRoute);

  return routes;
};

const extractPathFromUrl = (url: string): string | null => {
  try {
    // If it's a full URL, extract the pathname
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return urlObj.pathname;
    }
    // Otherwise, it's already a path
    return url;
  } catch {
    // If parsing fails, assume it's a path
    return url;
  }
};
