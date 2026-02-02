import type { RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { HomeView } from '../components/HomeView';
import { SettingsView } from '../features/settings/SettingsView';
import { ViewRoute } from '../components/ViewRoute';
import { NotFoundView } from '../components/NotFoundView';
import { AppLayout } from '../features/layouts/AppLayout';
import { flattenNavigationItems } from '../features/layouts/utils';
import urls from '../constants/urls';

export const createRoutes = (config: ShellUIConfig): RouteObject[] => {
  const routes: RouteObject[] = [{
    // Settings route (if configured)
    path: urls.settings,
    element: (
      <SettingsView />
    ),
    children: [
      {
        path: '*',
        element: <NotFoundView />,
      },
    ],
  },
  {
    // Catch-all route
    path: '*',
    element: <NotFoundView />,
  },
  ];

  // Main layout route with nested routes
  const layoutRoute: RouteObject = {
    element: (
      <AppLayout
        layout={config.layout}
        title={config.title}
        appIcon={config.appIcon}
        logo={config.logo}
        navigation={config.navigation || []}
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
    const navigationItems = flattenNavigationItems(config.navigation);
    navigationItems.forEach((item) => {
      layoutRoute.children!.push({
        path: `/${item.path}/*`,
        element: <ViewRoute navigation={navigationItems} />,
      });
    });
  }
  routes.push(layoutRoute);

  return routes;
};