import type { SettingsUser } from '@shellui/sdk';
import type { AuthSession } from '../types';

// Maps an SDK settings user object to the internal auth session shape.
export const toAuthSessionFromSettingsUser = (settingsUser: SettingsUser): AuthSession => ({
  accessToken: '',
  refreshToken: '',
  tokenType: 'bearer',
  // Long-lived synthetic expiry; parent shell controls real auth.
  expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  provider: settingsUser.authProvider,
  userId: settingsUser.id,
  userEmail: settingsUser.email,
  userName: settingsUser.name,
  userAvatarUrl: settingsUser.profilePicture,
});
