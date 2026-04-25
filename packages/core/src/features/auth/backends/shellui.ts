import {
  buildSessionFromParams,
  getShellUILoginClientTimezone,
  getShellUILoginDeviceId,
  isSessionExpired,
  normalizeAuthSettings,
  normalizeRedirectPath,
} from '../utils';
import { getShellUILoginCompanyId } from '../utils/clientLoginContext';
import type { AuthSession, UserPreferences } from '../types';
import type { AuthBackend } from './types';

const USER_PREFERENCES_ENDPOINT = '/auth/v1/preferences';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(normalized);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getCompanyIdFromAccessToken = (accessToken: string | null | undefined): string => {
  if (!accessToken) return '';
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return '';
  const raw = payload.company_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return raw.trim();
  return '';
};

export const createShellUIAuthBackend = ({
  backendUrl,
  companyId,
}: {
  backendUrl: string | null;
  companyId?: string | number;
}): AuthBackend => {
  const refreshWithStoredToken = async (
    storedSession: AuthSession,
    nowSeconds: number,
  ): Promise<AuthSession | null> => {
    if (!backendUrl || !storedSession.refreshToken) return null;

    const refreshUrl = new URL(`${backendUrl}/auth/v1/token`);
    refreshUrl.searchParams.set('grant_type', 'refresh_token');
    const companyId = getCompanyIdFromAccessToken(storedSession.accessToken);
    if (companyId) {
      refreshUrl.searchParams.set('company_id', companyId);
    }
    const clientTz = getShellUILoginClientTimezone();
    const response = await fetch(refreshUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: storedSession.refreshToken,
        ...(clientTz ? { client_timezone: clientTz } : {}),
      }),
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
  };

  return {
    type: 'shellui',
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
    startOAuth: (provider, redirectPath, oauthClientId) => {
      if (!backendUrl) {
        throw new Error('Missing ShellUI backend URL.');
      }
      const redirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;
      const authorizeUrl = new URL(`${backendUrl}/auth/v1/authorize`);
      authorizeUrl.searchParams.set('provider', provider);
      authorizeUrl.searchParams.set('redirect_to', redirectTo);
      if (typeof oauthClientId === 'number' && Number.isFinite(oauthClientId) && oauthClientId > 0) {
        authorizeUrl.searchParams.set('company_oauth_client_id', String(Math.trunc(oauthClientId)));
      }
      const selectedCompanyId = getShellUILoginCompanyId(companyId);
      if (selectedCompanyId) {
        authorizeUrl.searchParams.set('company_id', selectedCompanyId);
      }
      const clientTz = getShellUILoginClientTimezone();
      if (clientTz) {
        authorizeUrl.searchParams.set('client_timezone', clientTz);
      }
      const clientDeviceId = getShellUILoginDeviceId();
      if (clientDeviceId) {
        authorizeUrl.searchParams.set('client_device_id', clientDeviceId);
      }
      window.location.assign(authorizeUrl.toString());
    },
    startWeb3Ethereum: async () => {
      throw new Error('Ethereum wallet login is not supported by the shellui backend.');
    },
    logout: async (session) => {
      if (!backendUrl || !session?.accessToken) {
        return;
      }
      const endpoint = new URL(`${backendUrl}/auth/v1/logout`);
      const companyId = getCompanyIdFromAccessToken(session.accessToken);
      if (companyId) {
        endpoint.searchParams.set('company_id', companyId);
      }
      await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    },
    getAuthSettings: async () => {
      if (!backendUrl) {
        return { methods: [], oauthProviders: [], oauthClients: [] };
      }
      const endpoint = new URL(`${backendUrl}/auth/v1/settings`);
      const selectedCompanyId = getShellUILoginCompanyId(companyId);
      if (selectedCompanyId) {
        endpoint.searchParams.set('company_id', selectedCompanyId);
      }
      const response = await fetch(endpoint.toString(), {
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
      const endpoint = new URL(`${backendUrl}${USER_PREFERENCES_ENDPOINT}`);
      const companyId = getCompanyIdFromAccessToken(session.accessToken);
      if (companyId) {
        endpoint.searchParams.set('company_id', companyId);
      }
      const response = await fetch(endpoint.toString(), {
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
      const endpoint = new URL(`${backendUrl}${USER_PREFERENCES_ENDPOINT}`);
      const companyId = getCompanyIdFromAccessToken(session.accessToken);
      if (companyId) {
        endpoint.searchParams.set('company_id', companyId);
      }
      const response = await fetch(endpoint.toString(), {
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
  };
};
