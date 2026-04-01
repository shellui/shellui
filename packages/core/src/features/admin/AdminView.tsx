import { useEffect } from 'react';
import { Outlet, Route, Routes, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import urls from '../../constants/urls';
import { ContentView } from '../../components/ContentView';
import { LoginButton } from '../auth/components/LoginButton';
import { useAuth } from '../auth/hooks/useAuth';
import { useConfig } from '../config/useConfig';
import type { NavigationItem } from '../config/types';
import { AdminForbiddenAccess } from './components/AdminForbiddenAccess';

const AdminAccessGuard = ({ isStaff }: { isStaff: boolean }) => {
  if (!isStaff) {
    return <AdminForbiddenAccess />;
  }
  return <Outlet />;
};

export const AdminView = () => {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { user } = useAuth();
  const isStaff = Boolean(user?.isStaff);
  const backendAdminUrl = config.backend?.adminUrl?.trim();
  const adminPath =
    backendAdminUrl && backendAdminUrl.startsWith('/') ? backendAdminUrl : urls.admin;
  const adminContentUrl = urls.settings;
  const adminContentItem: NavigationItem = {
    label: 'Settings',
    path: adminPath.replace(/^\/+/, ''),
    url: adminContentUrl,
  };

  useEffect(() => {
    if (config?.title) {
      document.title = `Administration | ${config.title}`;
    } else {
      document.title = 'Administration';
    }
  }, [config?.title]);

  return (
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
          <LoginButton variant="appbar" logoutOnly />
        </div>
      </header>
      <main className="flex min-h-0 flex-1">
        <Routes>
          <Route element={<AdminAccessGuard isStaff={isStaff} />}>
            <Route
              path="*"
              element={
                <ContentView
                  url={adminContentUrl}
                  pathPrefix={adminPath.replace(/^\/+/, '')}
                  navItem={adminContentItem}
                  ignoreMessages={true}
                />
              }
            />
          </Route>
        </Routes>
      </main>
    </div>
  );
};
