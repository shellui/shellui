import { Navigate } from 'react-router';
import { useConfig } from '../../features/config/useConfig';
import { flattenNavigationItems } from '../../features/layouts/utils';
import { HomeView } from './HomeView';
import { ViewRoute } from './ViewRoute';

/**
 * Renders the root path "/":
 * - If start_url is set in config, redirects to start_url.
 * - Else if a navigation item has path "" or "/", shows that item's content.
 * - Otherwise shows the default HomeView.
 */
export const IndexRoute = () => {
  const { config } = useConfig();

  const startUrl = config?.start_url?.trim();
  if (startUrl) {
    const to = startUrl.startsWith('/') ? startUrl : `/${startUrl}`;
    return (
      <Navigate
        to={to}
        replace
      />
    );
  }

  const navigation = config?.navigation;
  if (navigation?.length) {
    const navigationItems = flattenNavigationItems(navigation);
    const rootNavItem = navigationItems.find((item) => item.path === '' || item.path === '/');
    if (rootNavItem) {
      return <ViewRoute navigation={navigationItems} />;
    }
  }

  return <HomeView />;
};
