import { ContentView } from '../../components/ContentView';
import { useNavigationItems } from '../hooks/useNavigationItems';
import { NotFoundView } from './NotFoundView';
import { Navigate, useLocation } from 'react-router';
import urls from '../../constants/urls';
import { useAuth } from '../../features/auth/useAuth';
import { RouteFallback } from './RouteFallback';

export const NavigationItemRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { url, currentItem } = useNavigationItems();

  if (!currentItem) {
    return <NotFoundView />;
  }

  if (currentItem.requiresAuth) {
    if (isLoading) {
      return <RouteFallback />;
    }
    if (!isAuthenticated) {
      const next = `${location.pathname}${location.search}`;
      const loginUrl = `${urls.login}?next=${encodeURIComponent(next)}`;
      return (
        <Navigate
          to={loginUrl}
          replace
        />
      );
    }
  }

  return (
    <ContentView
      url={url}
      pathPrefix={currentItem.path}
      navItem={currentItem}
    />
  );
};
