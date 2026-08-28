import { lazy, Suspense } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import type { ShellUIConfig } from '../features/config/types';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { AppLayout } from '../features/layouts/AppLayout';
import { flattenNavigationItems } from '../features/layouts/utils';
import urls from '../constants/urls';
import { createAdminRoute } from '../features/admin/routes';
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
const OverlayDynamicDemoView = lazy(() =>
  import('../features/overlays/OverlayDynamicDemoView').then((m) => ({
    default: m.OverlayDynamicDemoView,
  })),
);
const LoginView = lazy(() =>
  import('../features/auth/components/LoginView').then((m) => ({ default: m.LoginView })),
);
const OAuthCallbackView = lazy(() =>
  import('../features/auth/components/OAuthCallbackView').then((m) => ({
    default: m.OAuthCallbackView,
  })),
);
const LegalDocumentView = lazy(() =>
  import('../features/legal/LegalDocumentView').then((m) => ({ default: m.LegalDocumentView })),
);
const LegalDocumentsIndexView = lazy(() =>
  import('../features/legal/LegalDocumentsIndexView').then((m) => ({
    default: m.LegalDocumentsIndexView,
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
          // Compact overlay demo (develop → dynamicSizing)
          path: urls.overlayDemo.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <OverlayDynamicDemoView />
            </Suspense>
          ),
        },
        {
          // Login route
          path: urls.login.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LoginView />
            </Suspense>
          ),
        },
        {
          // OAuth callback route (frontend receives code, then exchanges via backend).
          path: urls.loginCallback.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <OAuthCallbackView />
            </Suspense>
          ),
        },
        {
          path: urls.legalDocuments.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LegalDocumentsIndexView />
            </Suspense>
          ),
        },
        {
          path: urls.legalPrivacyPolicy.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LegalDocumentView />
            </Suspense>
          ),
        },
        {
          path: urls.legalTermsOfService.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LegalDocumentView />
            </Suspense>
          ),
        },
        {
          path: urls.legalNotice.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LegalDocumentView />
            </Suspense>
          ),
        },
        {
          path: urls.legalDataProcessingAgreement.replace(/^\//, ''),
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LegalDocumentView />
            </Suspense>
          ),
        },
        createAdminRoute(config),
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
    children: [],
  };

  const navigationItems = flattenNavigationItems(config.navigation || []);
  const hasRootNavItem = navigationItems.some((item) => item.path === '' || item.path === '/');

  // Non-root nav items: /home/*, /docs/*, … — one route match keeps ContentView mounted
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

  // Root app (/ and /:deep): pathless parent + index/* children so ContentView does not
  // remount when moving between / and /layout (that remount was wiping shell history).
  // Without a root nav item, index still uses IndexRoute (HomeView / start_url).
  if (hasRootNavItem) {
    (layoutRoute.children as RouteObject[]).push({
      element: (
        <Suspense fallback={<RouteFallback />}>
          <IndexRoute />
        </Suspense>
      ),
      children: [{ index: true }, { path: '*' }],
    });
  } else {
    (layoutRoute.children as RouteObject[]).push({
      index: true,
      element: (
        <Suspense fallback={<RouteFallback />}>
          <IndexRoute />
        </Suspense>
      ),
    });
    if (navigationItems.length > 0) {
      (layoutRoute.children as RouteObject[]).push({
        path: '*',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <NavigationItemRoute />
          </Suspense>
        ),
      });
    }
  }

  // Layout must be before the top-level catch-all (*) so paths like /layout are handled
  // by layout → root IndexRoute, not the global NotFoundView
  (routes[0].children as RouteObject[]).unshift(layoutRoute);

  return routes;
};
