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
}

export interface AuthUser {
  id: string | null;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  authProvider: string | null;
}

type AuthEvent = 'oauth_callback' | null;

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authEvent: AuthEvent;
  clearAuthEvent: () => void;
  startSupabaseOAuth: (provider: string, redirectPath?: string) => void;
  logout: () => Promise<void>;
}

const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';
const AuthContext = createContext<AuthContextValue | null>(null);

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildSessionFromParams = (
  params: URLSearchParams,
  nowSeconds: number,
): AuthSession | null => {
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const expiresAtFromParam = Number(params.get('expires_at'));
  const expiresInFromParam = Number(params.get('expires_in'));
  const expiresAt =
    Number.isFinite(expiresAtFromParam) && expiresAtFromParam > 0
      ? expiresAtFromParam
      : Number.isFinite(expiresInFromParam) && expiresInFromParam > 0
        ? nowSeconds + expiresInFromParam
        : nowSeconds + 3600;

  const tokenType = params.get('token_type') ?? 'bearer';
  const payload = decodeJwtPayload(accessToken);
  const appMetadata =
    payload?.app_metadata && typeof payload.app_metadata === 'object'
      ? (payload.app_metadata as Record<string, unknown>)
      : null;
  const userMetadata =
    payload?.user_metadata && typeof payload.user_metadata === 'object'
      ? (payload.user_metadata as Record<string, unknown>)
      : null;
  const userId =
    typeof payload?.sub === 'string'
      ? payload.sub
      : typeof payload?.user_id === 'string'
        ? payload.user_id
        : null;

  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresAt,
    provider: typeof appMetadata?.provider === 'string' ? appMetadata.provider : null,
    userId,
    userEmail: typeof payload?.email === 'string' ? payload.email : null,
    userName:
      typeof userMetadata?.full_name === 'string'
        ? userMetadata.full_name
        : typeof userMetadata?.name === 'string'
          ? userMetadata.name
          : null,
    userAvatarUrl: typeof userMetadata?.avatar_url === 'string' ? userMetadata.avatar_url : null,
  };
};

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
  const backendType = config.backend?.type;
  const backendUrl = config.backend?.url?.replace(/\/+$/, '') ?? null;
  const publishableKey = config.backend?.publishableKey;

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
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const sessionFromHash = buildSessionFromParams(hashParams, now);
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

      if (backendType !== 'supabase' || !backendUrl || !publishableKey || !stored.refreshToken) {
        clearStoredSession();
        if (!cancelled) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const refreshUrl = new URL(`${backendUrl}/auth/v1/token`);
        refreshUrl.searchParams.set('grant_type', 'refresh_token');
        refreshUrl.searchParams.set('apikey', publishableKey);

        const response = await fetch(refreshUrl.toString(), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            apikey: publishableKey,
            Authorization: `Bearer ${publishableKey}`,
          },
          body: JSON.stringify({ refresh_token: stored.refreshToken }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const refreshParams = new URLSearchParams();
        if (typeof payload.access_token === 'string')
          refreshParams.set('access_token', payload.access_token);
        if (typeof payload.refresh_token === 'string') {
          refreshParams.set('refresh_token', payload.refresh_token);
        }
        if (typeof payload.expires_at === 'number' || typeof payload.expires_at === 'string') {
          refreshParams.set('expires_at', String(payload.expires_at));
        }
        if (typeof payload.expires_in === 'number' || typeof payload.expires_in === 'string') {
          refreshParams.set('expires_in', String(payload.expires_in));
        }
        if (typeof payload.token_type === 'string')
          refreshParams.set('token_type', payload.token_type);

        const refreshed = buildSessionFromParams(refreshParams, now);
        if (!refreshed) {
          throw new Error('Invalid refresh response');
        }

        if (!cancelled) {
          persistSession(refreshed);
          setSession(refreshed);
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
  }, [backendType, backendUrl, publishableKey]);

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

  const startSupabaseOAuth = useCallback(
    (provider: string, redirectPath = urls.login) => {
      if (backendType !== 'supabase' || !backendUrl || !publishableKey) {
        setError('Missing Supabase backend URL or publishableKey.');
        return;
      }

      const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
      const redirectTo = `${window.location.origin}${normalizedPath}`;
      const authorizeUrl = new URL(`${backendUrl}/auth/v1/authorize`);
      authorizeUrl.searchParams.set('provider', provider);
      authorizeUrl.searchParams.set('redirect_to', redirectTo);
      authorizeUrl.searchParams.set('apikey', publishableKey);
      window.location.assign(authorizeUrl.toString());
    },
    [backendType, backendUrl, publishableKey],
  );

  const logout = useCallback(async () => {
    if (backendType === 'supabase' && backendUrl && publishableKey && session?.accessToken) {
      try {
        const signOutUrl = new URL(`${backendUrl}/auth/v1/logout`);
        signOutUrl.searchParams.set('apikey', publishableKey);
        await fetch(signOutUrl.toString(), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            apikey: publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
      } catch {
        // Even if API sign-out fails, still clear local session.
      }
    }

    clearStoredSession();
    setSession(null);
    setAuthEvent(null);
    setError(null);
  }, [backendType, backendUrl, publishableKey, session?.accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const cleanup = shellui.addMessageListener('SHELLUI_LOGOUT', () => {
      void logout();
    });

    return () => cleanup();
  }, [logout]);

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
      startSupabaseOAuth,
      logout,
    }),
    [session, user, isLoading, error, authEvent, clearAuthEvent, startSupabaseOAuth, logout],
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
