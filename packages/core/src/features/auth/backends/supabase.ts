import {
  buildSessionFromParams,
  isSessionExpired,
  normalizeAuthSettings,
  normalizeRedirectPath,
} from '../utils';
import type { AuthSession, UserPreferences } from '../types';
import type { AuthBackend } from './types';
import { createClient } from '@supabase/supabase-js';

const USER_METADATA_ENDPOINT = '/auth/v1/user';
const APP_PREFERENCES_METADATA_KEY = 'shelluiPreferences';

const buildSessionFromSupabaseSession = (session: {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_at?: number;
  user?: {
    id?: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
}): AuthSession => {
  const userMetadata = session.user?.user_metadata ?? {};
  const appMetadata = session.user?.app_metadata ?? {};
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: session.token_type ?? 'bearer',
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    provider: typeof appMetadata.provider === 'string' ? appMetadata.provider : 'ethereum',
    userId: session.user?.id ?? null,
    userEmail: session.user?.email ?? null,
    userName:
      typeof userMetadata.full_name === 'string'
        ? userMetadata.full_name
        : typeof userMetadata.name === 'string'
          ? userMetadata.name
          : null,
    userAvatarUrl: typeof userMetadata.avatar_url === 'string' ? userMetadata.avatar_url : null,
    userIsStaff: userMetadata.is_staff === true,
    userPreferences:
      userMetadata.shelluiPreferences && typeof userMetadata.shelluiPreferences === 'object'
        ? (userMetadata.shelluiPreferences as UserPreferences)
        : null,
  };
};

export const createSupabaseAuthBackend = ({
  backendUrl,
  publishableKey,
}: {
  backendUrl: string | null;
  publishableKey: string | undefined;
}): AuthBackend => {
  const refreshWithStoredToken = async (
    storedSession: AuthSession,
    nowSeconds: number,
  ): Promise<AuthSession | null> => {
    if (!backendUrl || !publishableKey || !storedSession.refreshToken) return null;

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
      body: JSON.stringify({ refresh_token: storedSession.refreshToken }),
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
    if (typeof payload.token_type === 'string') refreshParams.set('token_type', payload.token_type);

    return buildSessionFromParams(refreshParams, nowSeconds);
  };

  return {
    type: 'supabase',
    readSessionFromCallback: (locationHash, nowSeconds) => {
      const hashParams = new URLSearchParams(locationHash.replace(/^#/, ''));
      return buildSessionFromParams(hashParams, nowSeconds);
    },
    restoreSession: async (storedSession, nowSeconds) => {
      if (!storedSession) return null;
      if (!isSessionExpired(storedSession)) return storedSession;
      return refreshWithStoredToken(storedSession, nowSeconds);
    },
    refreshAuthSession: async (currentSession, nowSeconds) => {
      if (!currentSession?.refreshToken) return null;
      return refreshWithStoredToken(currentSession, nowSeconds);
    },
    startOAuth: (provider, redirectPath) => {
      if (!backendUrl || !publishableKey) {
        throw new Error('Missing Supabase backend URL or publishableKey.');
      }
      const redirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;
      const authorizeUrl = new URL(`${backendUrl}/auth/v1/authorize`);
      authorizeUrl.searchParams.set('provider', provider);
      authorizeUrl.searchParams.set('redirect_to', redirectTo);
      authorizeUrl.searchParams.set('apikey', publishableKey);
      window.location.assign(authorizeUrl.toString());
    },
    startWeb3Ethereum: async () => {
      if (!backendUrl || !publishableKey) {
        throw new Error('Missing Supabase backend URL or publishableKey.');
      }
      if (
        typeof window === 'undefined' ||
        typeof (window as Window & { ethereum?: unknown }).ethereum === 'undefined'
      ) {
        throw new Error('No Ethereum wallet found. Install a wallet like MetaMask.');
      }

      const supabase = createClient(backendUrl, publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: 'ethereum',
        statement: `Sign in to ${window.location.host}`,
      });
      if (error) {
        throw new Error(error.message);
      }

      const session = data.session;
      if (!session?.access_token || !session.refresh_token) {
        throw new Error('Ethereum sign-in completed but no session was returned.');
      }
      return buildSessionFromSupabaseSession(session);
    },
    logout: async (session) => {
      if (!backendUrl || !publishableKey || !session?.accessToken) {
        return;
      }

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
    },
    getAuthSettings: async () => {
      if (!backendUrl) {
        return { methods: [], oauthProviders: [] };
      }

      const endpoint = new URL(`${backendUrl}/auth/v1/settings`);
      if (publishableKey) {
        endpoint.searchParams.set('apikey', publishableKey);
      }

      const headers: HeadersInit = { Accept: 'application/json' };
      if (publishableKey) {
        headers.apikey = publishableKey;
        headers.Authorization = `Bearer ${publishableKey}`;
      }

      const response = await fetch(endpoint.toString(), { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      return normalizeAuthSettings(payload);
    },
    sendMagicLink: async (email, redirectPath) => {
      if (!backendUrl || !publishableKey) {
        throw new Error('Missing Supabase backend URL or publishableKey.');
      }

      const otpUrl = new URL(`${backendUrl}/auth/v1/otp`);
      otpUrl.searchParams.set('apikey', publishableKey);
      const emailRedirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;

      const response = await fetch(otpUrl.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body: JSON.stringify({
          email,
          create_user: true,
          email_redirect_to: emailRedirectTo,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          msg?: string;
          message?: string;
          error_description?: string;
        } | null;
        throw new Error(
          payload?.msg ??
            payload?.message ??
            payload?.error_description ??
            `Could not send magic link (HTTP ${response.status}).`,
        );
      }
    },
    syncUserPreferences: async (session, preferences: UserPreferences) => {
      if (!backendUrl || !publishableKey || !session?.accessToken) {
        return;
      }

      const userUrl = new URL(`${backendUrl}${USER_METADATA_ENDPOINT}`);
      userUrl.searchParams.set('apikey', publishableKey);

      const response = await fetch(userUrl.toString(), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          data: {
            [APP_PREFERENCES_METADATA_KEY]: preferences,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    },
    loadUserPreferences: async (session) => {
      if (!backendUrl || !publishableKey || !session?.accessToken) {
        return null;
      }

      const userUrl = new URL(`${backendUrl}${USER_METADATA_ENDPOINT}`);
      userUrl.searchParams.set('apikey', publishableKey);

      const response = await fetch(userUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        user_metadata?: Record<string, unknown>;
      };
      const preferences = payload.user_metadata?.[APP_PREFERENCES_METADATA_KEY];
      if (!preferences || typeof preferences !== 'object') {
        return null;
      }
      return preferences as UserPreferences;
    },
  };
};
