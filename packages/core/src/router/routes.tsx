import type { RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { HomeView } from '../components/HomeView';
import { SettingsView } from '../features/settings/SettingsView';
import { ViewRoute } from '../components/ViewRoute';
import { NotFoundView } from '../components/NotFoundView';
import { DefaultLayout } from '../features/layouts/DefaultLayout';

export const createRoutes = (config: ShellUIConfig): RouteObject[] => {
  const routes: RouteObject[] = [{
    // Settings route (if configured)
    path: "__settings",
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
      <DefaultLayout
        title={config.title}
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
    config.navigation.forEach((item) => {
      layoutRoute.children!.push({
        path: `/${item.path}/*`,
        element: <ViewRoute navigation={config.navigation || []} />,
      });
    });
  }
  routes.push(layoutRoute);

  return routes;
};