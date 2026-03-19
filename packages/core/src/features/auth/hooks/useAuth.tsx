import { createContext, useContext } from 'react';
import type { AuthEvent, AuthSession, AuthSettings, AuthUser, UserPreferences } from '../types';

export type { AuthSession, AuthUser } from '../types';

export interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authEvent: AuthEvent;
  clearAuthEvent: () => void;
  startOAuth: (provider: string, redirectPath?: string) => boolean;
  getAuthSettings: () => Promise<AuthSettings>;
  sendMagicLink: (email: string, redirectPath?: string) => Promise<void>;
  syncUserPreferences: (preferences: UserPreferences) => Promise<void>;
  loadUserPreferences: () => Promise<UserPreferences | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
