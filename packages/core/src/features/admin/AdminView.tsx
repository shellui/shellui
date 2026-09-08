import { useEffect, useMemo, useRef } from 'react';
import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { ContentView } from '../../components/ContentView';
import { useIsMobile } from '../../hooks/use-mobile';
import { LoginButton } from '../auth/components/LoginButton';
import { useAuth } from '../auth/hooks/useAuth';
import { useConfig } from '../config/useConfig';
import type { NavigationItem } from '../config/types';
import { AppLayout } from '../layouts/AppLayout';
import {
  isShellUiRootWindow,
  SafeAreaTopbarOffset,
  SafeAreaTopbarStrip,
} from '../layouts/chrome/SafeAreaTopbar';
import { AdminForbiddenAccess } from './components/AdminForbiddenAccess';
import { getAdminContentUrl, getAdminPath } from './config';
import { buildAdminIframeSrc } from './utils';

const ADMIN_HEADER_HEIGHT_PX = 48;

const AdminAccessGuard = ({ allow }: { allow: boolean }) => {
  if (!allow) {
    return <AdminForbiddenAccess />;
  }
  return <Outlet />;
};

export const AdminView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useConfig();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const canOpenAdminPanel = Boolean(user?.isStaff || user?.isCompanyOwner);
  const adminPath = getAdminPath(config);
  const baseAdminContentUrl = getAdminContentUrl(config);
  const initialAdminContentUrlRef = useRef<string | null>(null);
  if (!initialAdminContentUrlRef.current) {
    const normalizedAdminPath = adminPath.replace(/\/+$/, '');
    initialAdminContentUrlRef.current = buildAdminIframeSrc(
      baseAdminContentUrl,
      normalizedAdminPath,
      location.pathname,
      location.search,
    );
  }
  const initialAdminContentUrl = initialAdminContentUrlRef.current;
  const adminContentItem = useMemo<NavigationItem>(
    () => ({
      label: 'Settings',
      path: adminPath.replace(/^\/+/, ''),
      url: baseAdminContentUrl,
      /** Required so ContentView maps iframe hash → shell path (`/admin`, `/admin/users`, …). */
      useHashRouter: true,
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

  const showSafeAreaTopbar = isShellUiRootWindow();
  const headerStyle = {
    paddingLeft: 'max(0.5rem, var(--shellui-safe-area-left))',
    paddingRight: 'max(0.75rem, var(--shellui-safe-area-right))',
    ...(isMobile && showSafeAreaTopbar
      ? {
          paddingTop: 'var(--shellui-safe-area-top)',
          height: `calc(${ADMIN_HEADER_HEIGHT_PX}px + var(--shellui-safe-area-top))`,
        }
      : { height: ADMIN_HEADER_HEIGHT_PX }),
  } as const;

  return (
    <AppLayout>
      <div
        data-shellui-admin-layout=""
        className="flex h-full w-full flex-col overflow-hidden bg-background"
      >
        <SafeAreaTopbarOffset enabled={showSafeAreaTopbar} />
        <SafeAreaTopbarStrip enabled={showSafeAreaTopbar} />
        <header
          className="flex shrink-0 items-center justify-between border-b bg-card"
          style={headerStyle}
        >
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
            <Route element={<AdminAccessGuard allow={canOpenAdminPanel} />}>
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
