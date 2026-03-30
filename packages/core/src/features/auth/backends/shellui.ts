import {
  buildSessionFromParams,
  isSessionExpired,
  normalizeAuthSettings,
  normalizeRedirectPath,
} from '../utils';
import type { UserPreferences } from '../types';
import type { AuthBackend } from './types';

const USER_PREFERENCES_ENDPOINT = '/auth/v1/preferences';

export const createShellUIAuthBackend = ({
  backendUrl,
}: {
  backendUrl: string | null;
}): AuthBackend => ({
  type: 'shellui',
  readSessionFromCallback: (locationHash, nowSeconds) => {
    const hashParams = new URLSearchParams(locationHash.replace(/^#/, ''));
    return buildSessionFromParams(hashParams, nowSeconds);
  },
  restoreSession: async (storedSession, nowSeconds) => {
    if (!storedSession) return null;
    if (!isSessionExpired(storedSession)) return storedSession;
    if (!backendUrl || !storedSession.refreshToken) return null;

    const refreshUrl = new URL(`${backendUrl}/auth/v1/token`);
    refreshUrl.searchParams.set('grant_type', 'refresh_token');
    const response = await fetch(refreshUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
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
    if (typeof payload.refresh_token === 'string')
      refreshParams.set('refresh_token', payload.refresh_token);
    if (typeof payload.expires_at === 'number' || typeof payload.expires_at === 'string') {
      refreshParams.set('expires_at', String(payload.expires_at));
    }
    if (typeof payload.expires_in === 'number' || typeof payload.expires_in === 'string') {
      refreshParams.set('expires_in', String(payload.expires_in));
    }
    if (typeof payload.token_type === 'string') refreshParams.set('token_type', payload.token_type);
    return buildSessionFromParams(refreshParams, nowSeconds);
  },
  startOAuth: (provider, redirectPath) => {
    if (!backendUrl) {
      throw new Error('Missing ShellUI backend URL.');
    }
    const redirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;
    const authorizeUrl = new URL(`${backendUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', provider);
    authorizeUrl.searchParams.set('redirect_to', redirectTo);
    window.location.assign(authorizeUrl.toString());
  },
  startWeb3Ethereum: async () => {
    throw new Error('Ethereum wallet login is not supported by the shellui backend.');
  },
  logout: async (session) => {
    if (!backendUrl || !session?.accessToken) {
      return;
    }
    await fetch(`${backendUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
  },
  getAuthSettings: async () => {
    if (!backendUrl) {
      return { methods: [], oauthProviders: [] };
    }
    const response = await fetch(`${backendUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    return normalizeAuthSettings(payload);
  },
  sendMagicLink: async (email, redirectPath) => {
    if (!backendUrl) {
      throw new Error('Missing ShellUI backend URL.');
    }
    const emailRedirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;
    const response = await fetch(`${backendUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
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
        error?: string;
      } | null;
      throw new Error(
        payload?.msg ??
          payload?.message ??
          payload?.error ??
          `Could not send magic link (HTTP ${response.status}).`,
      );
    }
  },
  syncUserPreferences: async (session, preferences: UserPreferences) => {
    if (!backendUrl || !session?.accessToken) {
      return;
    }
    const response = await fetch(`${backendUrl}${USER_PREFERENCES_ENDPOINT}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(preferences),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  },
  loadUserPreferences: async (session) => {
    if (!backendUrl || !session?.accessToken) {
      return null;
    }
    const response = await fetch(`${backendUrl}${USER_PREFERENCES_ENDPOINT}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const preferences = (await response.json()) as Record<string, unknown>;
    if (!preferences || typeof preferences !== 'object') {
      return null;
    }
    return preferences as UserPreferences;
  },
});
