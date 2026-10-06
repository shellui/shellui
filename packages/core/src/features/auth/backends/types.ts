import type { BackendConfig } from '../../config/types';
import type { AuthSession, AuthSettings, UserPreferences } from '../types';

export interface AuthBackend {
  type: BackendConfig['type'] | 'none';
  readSessionFromCallback: (locationHash: string, nowSeconds: number) => AuthSession | null;
  exchangeOAuthSessionCode: (params: {
    authCode: string;
    redirectTo: string;
    nowSeconds: number;
  }) => Promise<AuthSession | null>;
  exchangeOAuthCode: (params: {
    provider: string;
    code: string;
    redirectUri: string;
    oauthClientId?: number;
    nowSeconds: number;
  }) => Promise<AuthSession | null>;
  restoreSession: (
    storedSession: AuthSession | null,
    nowSeconds: number,
  ) => Promise<AuthSession | null>;
  /** Re-fetch tokens so the access JWT reflects latest user claims (e.g. after preference sync). */
  refreshAuthSession: (
    session: AuthSession | null,
    nowSeconds: number,
  ) => Promise<AuthSession | null>;
  startOAuth: (provider: string, redirectPath: string, oauthClientId?: number) => void;
  startWeb3Ethereum: () => Promise<AuthSession | null>;
  logout: (session: AuthSession | null) => Promise<void>;
  /** Whether {@link deleteAccount} is implemented for this backend. */
  supportsAccountDeletion: boolean;
  /** Permanently delete the signed-in user for the session's company. */
  deleteAccount: (session: AuthSession | null) => Promise<void>;
  /** Whether {@link updateProfile} is implemented for this backend. */
  supportsProfileUpdate: boolean;
  /** Update the signed-in user's display name; resolves with the name as stored. */
  updateProfile: (
    session: AuthSession | null,
    profile: { name: string },
  ) => Promise<{ name: string }>;
  getAuthSettings: () => Promise<AuthSettings>;
  sendMagicLink: (
    email: string,
    redirectPath: string,
    options?: { language?: string },
  ) => Promise<void>;
  syncUserPreferences: (session: AuthSession | null, preferences: UserPreferences) => Promise<void>;
  loadUserPreferences: (session: AuthSession | null) => Promise<UserPreferences | null>;
}
