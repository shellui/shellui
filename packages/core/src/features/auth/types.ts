export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: number;
  provider: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userAvatarUrl: string | null;
  userPreferences?: UserPreferences | null;
}

export interface AuthUser {
  id: string | null;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  authProvider: string | null;
}

export type AuthEvent = 'oauth_callback' | null;

export type LoginMethod = 'password' | 'oauth' | 'magic_link' | 'web3';

export interface AuthSettings {
  methods: LoginMethod[];
  oauthProviders: string[];
}

export type UserPreferences = {
  themeName?: string;
  language?: string;
  region?: string;
  colorScheme?: 'light' | 'dark' | 'system';
};
