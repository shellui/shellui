import { lazy, Suspense } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { AppLayout } from '../features/layouts/AppLayout';
import { flattenNavigationItems } from '../features/layouts/utils';
import urls from '../constants/urls';

// Lazy load route components
const HomeView = lazy(() =>
  import('../components/HomeView').then((m) => ({ default: m.HomeView })),
);
const SettingsView = lazy(() =>
  import('../features/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const CookiePreferencesView = lazy(() =>
  import('../features/cookieConsent/CookiePreferencesView').then((m) => ({
    default: m.CookiePreferencesView,
  })),
);
const ViewRoute = lazy(() =>
  import('../components/ViewRoute').then((m) => ({ default: m.ViewRoute })),
);
const NotFoundView = lazy(() =>
  import('../components/NotFoundView').then((m) => ({ default: m.NotFoundView })),
);

function RouteFallback() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-hidden
    />
  );
}

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
            <HomeView />
          </Suspense>
        ),
      },
    ],
  };

  // Add navigation routes
  if (config.navigation && config.navigation.length > 0) {
    const navigationItems = flattenNavigationItems(config.navigation);
    navigationItems.forEach((item) => {
      (layoutRoute.children as RouteObject[]).push({
        path: `/${item.path}/*`,
        element: (
          <Suspense fallback={<RouteFallback />}>
            <ViewRoute navigation={navigationItems} />
          </Suspense>
        ),
      });
    });
  }
  (routes[0].children as RouteObject[]).push(layoutRoute);

  return routes;
};
