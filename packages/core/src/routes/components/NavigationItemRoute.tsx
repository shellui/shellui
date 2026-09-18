import { ContentView } from '../../components/ContentView';
import { useNavigationItems } from '../hooks/useNavigationItems';
import { NotFoundView } from './NotFoundView';
import { Navigate, useLocation } from 'react-router';
import urls from '../../constants/urls';
import { buildAuthUrlWithNext } from '../../features/auth/utils';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { AdminForbiddenAccess } from '../../features/admin/components/AdminForbiddenAccess';
import { getNavigationRouteAccess } from '../utils/navigationRouteAccess';
import { RouteFallback } from './RouteFallback';

export const NavigationItemRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { url, currentItem } = useNavigationItems();

  if (!currentItem) {
    return <NotFoundView />;
  }

  const next = `${location.pathname}${location.search}`;
  const access = getNavigationRouteAccess(
    currentItem,
    {
      isLoading,
      isAuthenticated,
      isStaff: Boolean(user?.isStaff),
    },
    next,
  );

  if (access.kind === 'loading') {
    return <RouteFallback />;
  }

  if (access.kind === 'login') {
    const loginUrl = buildAuthUrlWithNext(urls.login, access.next);
    return (
      <Navigate
        to={loginUrl}
        replace
      />
    );
  }

  if (access.kind === 'forbidden') {
    return <AdminForbiddenAccess />;
  }

  return (
    <ContentView
      url={url}
      pathPrefix={currentItem.path}
      navItem={currentItem}
    />
  );
};
