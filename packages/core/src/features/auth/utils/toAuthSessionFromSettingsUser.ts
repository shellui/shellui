import type { SettingsUser } from '@shellui/sdk';
import type { AuthSession } from '../types';
import { decodeJwtPayload, normalizeJwtUserGroups } from './decodeJwtPayload';

// Maps an SDK settings user object to the internal auth session shape.
export const toAuthSessionFromSettingsUser = (
  settingsUser: SettingsUser,
  accessToken: string | null = null,
): AuthSession => {
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const userMetadata =
    payload?.user_metadata && typeof payload.user_metadata === 'object'
      ? (payload.user_metadata as Record<string, unknown>)
      : null;
  const fromJwt = userMetadata ? normalizeJwtUserGroups(userMetadata.groups) : [];
  const fromSettings = Array.isArray(settingsUser.groups)
    ? normalizeJwtUserGroups(settingsUser.groups)
    : [];

  return {
    accessToken: accessToken ?? '',
    refreshToken: '',
    tokenType: 'bearer',
    // Long-lived synthetic expiry; parent shell controls real auth.
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    provider: settingsUser.authProvider,
    userId: settingsUser.id,
    userEmail: settingsUser.email,
    userName: settingsUser.name,
    userAvatarUrl: settingsUser.profilePicture,
    userIsStaff: userMetadata?.is_staff === true,
    userIsCompanyOwner: userMetadata?.is_company_owner === true,
    userGroups: fromSettings.length ? fromSettings : fromJwt,
    userPreferences: null,
  };
};
