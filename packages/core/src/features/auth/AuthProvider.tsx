import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getLogger, shellui, type Settings } from '@shellui/sdk';
import urls from '../../constants/urls';
import { useConfig } from '../config/useConfig';
import { createAuthBackend } from './backends';
import { AuthContext, type AuthContextValue } from './hooks/useAuth';
import type { AuthEvent, AuthSession, AuthUser, UserPreferences } from './types';
import {
  clearStoredAuthSession,
  getAccessTokenFromSdkSettings,
  getUserFromSdkSettings,
  isSessionExpired,
  persistAuthSession,
  readStoredAuthSession,
  toAuthSessionFromSettingsUser,
} from './utils';

const logger = getLogger('shellcore');

type LoginMessagePayload = {
  method?: 'oauth' | 'web3';
  provider?: string;
  chain?: 'ethereum';
  redirectPath?: string;
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
          persistAuthSession(sessionFromHash);
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
        const sdkAccessToken = getAccessTokenFromSdkSettings();
        if (!cancelled) {
          setSession(sdkUser ? toAuthSessionFromSettingsUser(sdkUser, sdkAccessToken) : null);
          setIsLoading(false);
        }
        return;
      }

      const stored = readStoredAuthSession();
      if (!stored) {
        if (!cancelled) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      if (!isSessionExpired(stored)) {
        if (!cancelled) {
          setSession(stored);
          setIsLoading(false);
        }
        return;
      }

      try {
        const restored = await backend.restoreSession(stored, now);
        if (!restored) {
          clearStoredAuthSession();
          if (!cancelled) {
            setSession(null);
            setIsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          persistAuthSession(restored);
          setSession(restored);
          setIsLoading(false);
        }
      } catch {
        clearStoredAuthSession();
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
      const settingsAccessToken = payload.settings?.accessToken ?? null;
      setSession(
        settingsUser ? toAuthSessionFromSettingsUser(settingsUser, settingsAccessToken) : null,
      );
    };

    const cleanupSettingsUpdated = shellui.addMessageListener(
      'SHELLUI_SETTINGS_UPDATED',
      (message) => {
        syncSessionFromSettings(message);
      },
    );

    return () => {
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

  const startWeb3Ethereum = useCallback(async () => {
    try {
      setError(null);
      const nextSession = await backend.startWeb3Ethereum();
      if (!nextSession) {
        setError('Unable to complete Ethereum wallet login.');
        return false;
      }
      persistAuthSession(nextSession);
      setSession(nextSession);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Ethereum wallet login.');
      return false;
    }
  }, [backend]);

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

  const syncUserPreferences = useCallback(
    async (preferences: UserPreferences) => {
      try {
        await backend.syncUserPreferences(session, preferences);
      } catch (err) {
        logger.error('Failed to sync user preferences to auth provider metadata', { err });
      }
    },
    [backend, session],
  );

  const loadUserPreferences = useCallback(async () => {
    try {
      return await backend.loadUserPreferences(session);
    } catch (err) {
      logger.error('Failed to load user preferences from auth provider metadata', { err });
      return null;
    }
  }, [backend, session]);

  const logout = useCallback(async () => {
    try {
      await backend.logout(session);
    } catch {
      // Even if API sign-out fails, still clear local session.
    }

    clearStoredAuthSession();
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
      if (payload.method === 'web3') {
        if (payload.chain && payload.chain !== 'ethereum') {
          return;
        }
        void (async () => {
          const started = await startWeb3Ethereum();
          if (started && typeof window !== 'undefined') {
            window.postMessage({ type: 'SHELLUI_CLOSE_MODAL', payload: {} }, '*');
          }
        })();
        return;
      }
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
  }, [startOAuth, startWeb3Ethereum]);

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
      isAuthenticated: session !== null && !isSessionExpired(session),
      isLoading,
      error,
      authEvent,
      clearAuthEvent,
      startOAuth,
      startWeb3Ethereum,
      getAuthSettings,
      sendMagicLink,
      syncUserPreferences,
      loadUserPreferences,
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
      startWeb3Ethereum,
      getAuthSettings,
      sendMagicLink,
      syncUserPreferences,
      loadUserPreferences,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
