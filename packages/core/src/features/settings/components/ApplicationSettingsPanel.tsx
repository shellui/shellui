import type { NavigationItem } from '../../config/types';
import { ContentView } from '../../../components/ContentView';

interface ApplicationSettingsPanelProps {
  url: string;
  pathPrefix: string;
  navItem: NavigationItem;
}

export const ApplicationSettingsPanel = ({
  url,
  pathPrefix,
  navItem,
}: ApplicationSettingsPanelProps) => {
  return (
    <div className="m-0 p-0 flex flex-1 flex-col min-h-0 w-full overflow-hidden bg-background">
      <ContentView
        url={url}
        pathPrefix={pathPrefix}
        navItem={navItem}
        ignoreMessages={true}
      />
    </div>
  );
};
