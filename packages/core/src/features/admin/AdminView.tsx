import { useEffect, useMemo, useRef } from 'react';
import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import urls from '../../constants/urls';
import { ContentView } from '../../components/ContentView';
import { LoginButton } from '../auth/components/LoginButton';
import { useAuth } from '../auth/hooks/useAuth';
import { useConfig } from '../config/useConfig';
import type { NavigationItem } from '../config/types';
import { AdminForbiddenAccess } from './components/AdminForbiddenAccess';
import { AppLayout } from '../layouts/AppLayout';

const AdminAccessGuard = ({ isStaff }: { isStaff: boolean }) => {
  if (!isStaff) {
    return <AdminForbiddenAccess />;
  }
  return <Outlet />;
};

export const AdminView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useConfig();
  const { user } = useAuth();
  const isStaff = Boolean(user?.isStaff);
  const configuredAdminPathname = config.backend?.adminPathname?.trim();
  const adminPath =
    configuredAdminPathname && configuredAdminPathname.startsWith('/')
      ? configuredAdminPathname
      : urls.admin;
  const baseAdminContentUrl = config.backend?.adminUrl?.trim() || urls.settings;
  const initialAdminContentUrlRef = useRef<string | null>(null);
  if (!initialAdminContentUrlRef.current) {
    const normalizedAdminPath = adminPath.replace(/\/+$/, '');
    const currentPath = location.pathname;
    const suffix = currentPath.startsWith(normalizedAdminPath)
      ? currentPath.slice(normalizedAdminPath.length)
      : '';
    const safeSuffix = suffix || '';

    try {
      const resolvedUrl = new URL(baseAdminContentUrl);
      resolvedUrl.pathname = `${resolvedUrl.pathname.replace(/\/+$/, '')}${safeSuffix}` || '/';
      resolvedUrl.search = location.search;
      initialAdminContentUrlRef.current = resolvedUrl.toString();
    } catch {
      const cleanBase = baseAdminContentUrl.replace(/\/+$/, '');
      initialAdminContentUrlRef.current = `${cleanBase}${safeSuffix}${location.search}`;
    }
  }
  const initialAdminContentUrl = initialAdminContentUrlRef.current;
  const adminContentItem = useMemo<NavigationItem>(
    () => ({
      label: 'Settings',
      path: adminPath.replace(/^\/+/, ''),
      url: baseAdminContentUrl,
    }),
    [adminPath, baseAdminContentUrl],
  );

  useEffect(() => {
    if (config?.title) {
      document.title = `Administration | ${config.title}`;
    } else {
      document.title = 'Administration';
    }
  }, [config?.title]);

  return (
    <AppLayout>
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-2 md:px-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to home
          </Button>
          <div className="flex items-center gap-2">
            <LoginButton
              variant="appbar"
              logoutOnly
            />
          </div>
        </header>
        <main className="flex min-h-0 flex-1">
          <Routes>
            <Route element={<AdminAccessGuard isStaff={isStaff} />}>
              <Route
                path="*"
                element={
                  <ContentView
                    url={initialAdminContentUrl}
                    pathPrefix={adminPath.replace(/^\/+/, '')}
                    navItem={adminContentItem}
                  />
                }
              />
            </Route>
          </Routes>
        </main>
      </div>
    </AppLayout>
  );
};
