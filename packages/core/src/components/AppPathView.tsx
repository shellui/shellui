import { useParams } from 'react-router';
import { useConfig } from '../features/config/useConfig';
import { flattenNavigationItems } from '../features/layouts/utils';
import { NotFoundView } from './NotFoundView';

/**
 * Renders the React component for a navigation item when the app is loaded at /__app/:path.
 * Uses navItem.component (when config is not serialized) or shelluiComponents from context (injected by CLI when componentPath is set).
 */
export const AppPathView = () => {
  const { config, shelluiComponents } = useConfig();
  const { path: pathParam } = useParams<{ path: string }>();
  const navigation = config?.navigation;
  const items = navigation?.length ? flattenNavigationItems(navigation) : [];
  const navItem = pathParam
    ? items.find(
        (item) =>
          item.path === pathParam ||
          (pathParam === 'home' && (item.path === '' || item.path === '/')),
      )
    : null;

  const pathKey = pathParam === 'home' || !pathParam ? 'home' : pathParam;
  const Component = navItem?.component ?? shelluiComponents?.[pathKey];

  if (!Component) {
    return <NotFoundView />;
  }

  return <Component />;
};
