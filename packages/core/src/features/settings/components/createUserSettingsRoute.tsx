import type { ReactElement } from 'react';
import type { Settings } from '@shellui/sdk';
import type { AuthUser } from '../../auth/hooks/useAuth';
import { UserIcon } from './UserIcon';
import { UserSettingsPanel } from './UserSettingsPanel';

type SettingsRouteItem = {
  name: string;
  icon?: () => ReactElement;
  path: string;
  element: ReactElement;
};

export const createUserSettingsRoute = (
  user: AuthUser | null,
  logout: () => Promise<void>,
  t: (key: string, options?: { defaultValue?: string }) => string,
  options: {
    developerModeEnabled: boolean;
    accessToken: string | null;
    settingsAccessToken: string | null;
    rawUserSettings: Settings['user'];
  },
): SettingsRouteItem[] =>
  user
    ? [
        {
          name: t('routes.userAccount', { defaultValue: 'user account' }),
          icon: UserIcon,
          path: 'user',
          element: (
            <UserSettingsPanel
              user={user}
              onLogout={logout}
              developerModeEnabled={options.developerModeEnabled}
              accessToken={options.accessToken}
              settingsAccessToken={options.settingsAccessToken}
              rawUserSettings={options.rawUserSettings}
            />
          ),
        },
      ]
    : [];
