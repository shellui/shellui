import type { BackendConfig } from '../../config/types';
import type { AuthSession, AuthSettings, UserPreferences } from '../types';

export interface AuthBackend {
  type: BackendConfig['type'] | 'none';
  readSessionFromCallback: (locationHash: string, nowSeconds: number) => AuthSession | null;
  restoreSession: (
    storedSession: AuthSession | null,
    nowSeconds: number,
  ) => Promise<AuthSession | null>;
  startOAuth: (provider: string, redirectPath: string) => void;
  logout: (session: AuthSession | null) => Promise<void>;
  getAuthSettings: () => Promise<AuthSettings>;
  sendMagicLink: (email: string, redirectPath: string) => Promise<void>;
  syncUserPreferences: (session: AuthSession | null, preferences: UserPreferences) => Promise<void>;
}
