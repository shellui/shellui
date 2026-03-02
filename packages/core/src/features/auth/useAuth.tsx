import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { shellui, type Settings, type SettingsUser } from '@shellui/sdk';
import { useConfig } from '../config/useConfig';
import urls from '../../constants/urls';
import { createAuthBackend } from './backends';
import type { AuthEvent, AuthSession, AuthSettings, AuthUser } from './types';

export type { AuthSession, AuthUser } from './types';
type LoginMessagePayload = {
  method?: 'oauth';
  provider?: string;
  redirectPath?: string;
};

interface AuthContextValue {
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
  logout: () => Promise<void>;
}

const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';
const AuthContext = createContext<AuthContextValue | null>(null);

const persistSession = (session: AuthSession) => {
  try {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors (e.g. private mode); user can still continue in-memory.
  }
};

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};

const isExpired = (session: AuthSession) => session.expiresAt <= Math.floor(Date.now() / 1000) + 30;

const toAuthSessionFromSettingsUser = (settingsUser: SettingsUser): AuthSession => ({
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

const getUserFromSdkSettings = (): SettingsUser | null => {
  const initialSettings = shellui.initialSettings as Settings | null;
  return initialSettings?.user ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { config } = useConfig();
  const backend = useMemo(
    () => createAuthBackend(config.backend),
    [config.backend?.publishableKey, config.backend?.type, config.backend?.url],
  );

  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authEvent, setAuthEvent] = useState<AuthEvent>(null);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      setIsLoading(true);
      setError(null);

      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const isIframe = window.parent !== window;
      const now = Math.floor(Date.now() / 1000);
      const sessionFromHash = backend.readSessionFromCallback(window.location.hash, now);
      if (sessionFromHash) {
        if (!cancelled) {
          persistSession(sessionFromHash);
          setSession(sessionFromHash);
          setAuthEvent('oauth_callback');
          if (window.location.hash) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search,
            );
          }
          setIsLoading(false);
        }
        return;
      }

      if (isIframe) {
        const sdkUser = getUserFromSdkSettings();
        if (!cancelled) {
          setSession(sdkUser ? toAuthSessionFromSettingsUser(sdkUser) : null);
          setIsLoading(false);
        }
        return;
      }

      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      if (!isExpired(stored)) {
        if (!cancelled) {
          setSession(stored);
          setIsLoading(false);
        }
        return;
      }

      try {
        const restored = await backend.restoreSession(stored, now);
        if (!restored) {
          clearStoredSession();
          if (!cancelled) {
            setSession(null);
            setIsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          persistSession(restored);
          setSession(restored);
          setIsLoading(false);
        }
      } catch {
        clearStoredSession();
        if (!cancelled) {
          setSession(null);
          setIsLoading(false);
        }
      }
    };

    void initializeSession();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) {
      return;
    }

    const syncSessionFromSettings = (message: { payload: unknown }) => {
      const payload = message.payload as { settings?: Settings };
      const settingsUser = payload.settings?.user ?? null;
      setSession(settingsUser ? toAuthSessionFromSettingsUser(settingsUser) : null);
    };

    const cleanupSettings = shellui.addMessageListener('SHELLUI_SETTINGS', (message) => {
      syncSessionFromSettings(message);
    });

    const cleanupSettingsUpdated = shellui.addMessageListener(
      'SHELLUI_SETTINGS_UPDATED',
      (message) => {
        syncSessionFromSettings(message);
      },
    );

    return () => {
      cleanupSettings();
      cleanupSettingsUpdated();
    };
  }, []);

  const startOAuth = useCallback(
    (provider: string, redirectPath = urls.login) => {
      try {
        setError(null);
        backend.startOAuth(provider, redirectPath);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start OAuth login.');
        return false;
      }
    },
    [backend],
  );

  const getAuthSettings = useCallback(() => backend.getAuthSettings(), [backend]);

  const sendMagicLink = useCallback(
    async (email: string, redirectPath = urls.login) => {
      try {
        await backend.sendMagicLink(email, redirectPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not send magic link.';
        throw new Error(message);
      }
    },
    [backend],
  );

  const logout = useCallback(async () => {
    try {
      await backend.logout(session);
    } catch {
      // Even if API sign-out fails, still clear local session.
    }

    clearStoredSession();
    setSession(null);
    setAuthEvent(null);
    setError(null);
  }, [backend, session]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const cleanup = shellui.addMessageListener('SHELLUI_LOGOUT', () => {
      void logout();
    });

    return () => cleanup();
  }, [logout]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const cleanup = shellui.addMessageListener('SHELLUI_LOGIN', (message) => {
      const payload = (message.payload ?? {}) as LoginMessagePayload;
      if (payload.method !== 'oauth' || typeof payload.provider !== 'string') {
        return;
      }

      const provider = payload.provider.trim();
      if (!provider) {
        return;
      }

      startOAuth(provider, payload.redirectPath || urls.login);
    });

    return () => cleanup();
  }, [startOAuth]);

  const clearAuthEvent = useCallback(() => setAuthEvent(null), []);
  const user = useMemo<AuthUser | null>(
    () =>
      session
        ? {
            id: session.userId,
            email: session.userEmail,
            name: session.userName,
            profilePicture: session.userAvatarUrl,
            authProvider: session.provider,
          }
        : null,
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAuthenticated: session !== null && !isExpired(session),
      isLoading,
      error,
      authEvent,
      clearAuthEvent,
      startOAuth,
      getAuthSettings,
      sendMagicLink,
      logout,
    }),
    [
      session,
      user,
      isLoading,
      error,
      authEvent,
      clearAuthEvent,
      startOAuth,
      getAuthSettings,
      sendMagicLink,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
