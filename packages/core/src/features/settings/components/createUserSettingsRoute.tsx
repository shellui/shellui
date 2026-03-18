import type { ReactElement } from 'react';
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
            />
          ),
        },
      ]
    : [];
