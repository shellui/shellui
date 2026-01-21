import type { RouteObject } from 'react-router';
import type { ShellUIConfig, NavigationItem, NavigationGroup } from '../features/config/types';
import { HomeView } from '../components/HomeView';
import { SettingsView } from '../features/settings/SettingsView';
import { ViewRoute } from '../components/ViewRoute';
import { NotFoundView } from '../components/NotFoundView';
import { DefaultLayout } from '../features/layouts/DefaultLayout';

// Helper function to flatten navigation items from groups or flat array
const flattenNavigationItems = (navigation: (NavigationItem | NavigationGroup)[]): NavigationItem[] => {
  if (navigation.length === 0) {
    return [];
  }
  
  return navigation.flatMap(item => {
    // Check if item is a group
    if ('title' in item && 'items' in item) {
      return (item as NavigationGroup).items;
    }
    // It's a standalone NavigationItem
    return item as NavigationItem;
  });
};

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