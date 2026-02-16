import { ContentView } from '../../components/ContentView';
import { useNavigationItems } from '../hooks/useNavigationItems';
import { NotFoundView } from './NotFoundView';

export const NavigationItemRoute = () => {
  const { url, currentItem } = useNavigationItems();

  if (!currentItem) {
    return <NotFoundView />;
  }

  return (
    <ContentView
      url={url}
      pathPrefix={currentItem.path}
      navItem={currentItem}
    />
  );
};
