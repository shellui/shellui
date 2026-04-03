import type { Settings } from '@shellui/sdk';
import type { AuthUser } from '../../auth/hooks/useAuth';

export const toSettingsUser = (user: AuthUser | null): Settings['user'] => {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePicture: user.profilePicture,
    authProvider: user.authProvider,
    groups: user.groups.length ? [...user.groups] : null,
  };
};
