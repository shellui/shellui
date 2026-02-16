import { lazy, Suspense } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { AppLayout } from '../features/layouts/AppLayout';
import { flattenNavigationItems } from '../features/layouts/utils';
import urls from '../constants/urls';
import { RouteFallback } from './components/RouteFallback';

// Lazy load route components
const SettingsView = lazy(() =>
  import('../features/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const CookiePreferencesView = lazy(() =>
  import('../features/cookieConsent/CookiePreferencesView').then((m) => ({
    default: m.CookiePreferencesView,
  })),
);
const NavigationItemRoute = lazy(() =>
  import('./components/NavigationItemRoute').then((m) => ({ default: m.NavigationItemRoute })),
);
const IndexRoute = lazy(() =>
  import('./components/IndexRoute').then((m) => ({ default: m.IndexRoute })),
);
const NotFoundView = lazy(() =>
  import('./components/NotFoundView').then((m) => ({ default: m.NotFoundView })),
);

export const createRoutes = (config: ShellUIConfig): RouteObject[] => {
  const routes: RouteObject[] = [
    {
      path: '/',
      element: <Outlet />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          // Settings route (if configured)
          path: `${urls.settings.replace(/^\//, '')}/*`,
          element: (
            <Suspense fallback={<RouteFallback />}>
              <SettingsView />
            </Suspense>
          ),
        },
        {
          // Cookie preferences route
          path: urls.cookiePreferences.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <CookiePreferencesView />
            </Suspense>
          ),
        },
        {
          // Catch-all route
          path: '*',
          element: (
            <Suspense fallback={<RouteFallback />}>
              <NotFoundView />
            </Suspense>
          ),
        },
      ],
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
        element: (
          <Suspense fallback={<RouteFallback />}>
            <IndexRoute />
          </Suspense>
        ),
      },
    ],
  };

  // Add navigation routes (skip items with path '' or '/' — they are shown at "/" via IndexRoute)
  if (config.navigation && config.navigation.length > 0) {
    const navigationItems = flattenNavigationItems(config.navigation);
    navigationItems.forEach((item) => {
      if (item.path === '' || item.path === '/') return;
      (layoutRoute.children as RouteObject[]).push({
        path: `/${item.path}/*`,
        element: (
          <Suspense fallback={<RouteFallback />}>
            <NavigationItemRoute />
          </Suspense>
        ),
      });
    });
    // Catch-all: no nav match (e.g. /layout) → NavigationItemRoute can use root item with pathname as hash subpath to avoid 404
    (layoutRoute.children as RouteObject[]).push({
      path: '*',
      element: (
        <Suspense fallback={<RouteFallback />}>
          <NavigationItemRoute />
        </Suspense>
      ),
    });
  }
  // Layout must be before the catch-all (*) so paths like /layout are handled by layout → NavigationItemRoute (root fallback), not 404
  (routes[0].children as RouteObject[]).unshift(layoutRoute);

  return routes;
};
