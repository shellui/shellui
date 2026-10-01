import {
  buildSessionFromTokenPayload,
  buildSessionFromParams,
  getShellUILoginClientTimezone,
  getShellUILoginDeviceId,
  isSessionExpired,
  normalizeAuthSettings,
  normalizeRedirectPath,
} from '../utils';
import { AuthRequestError } from '../utils/authRequestError';
import { getShellUILoginCompanyId } from '../utils/clientLoginContext';
import type { AuthSession, UserPreferences } from '../types';
import type { AuthBackend } from './types';

const USER_PREFERENCES_ENDPOINT = '/api/v1/preferences';
const OAUTH_EXCHANGE_ENDPOINT = '/api/v1/oauth/exchange';
const OAUTH_SESSION_ENDPOINT = '/api/v1/oauth/session';
const MAGIC_LINK_REQUEST_ENDPOINT = '/api/v1/magic-link/request';
const USER_ENDPOINT = '/api/v1/user';

const parseAuthErrorPayload = (
  payload: Record<string, unknown> | null,
  response: Response,
): never => {
  const err = payload?.error ?? payload?.detail;
  const message = typeof err === 'string' && err.trim() ? err : `HTTP ${response.status}`;
  let errorCode = typeof payload?.error_code === 'string' ? payload.error_code.trim() : null;
  if (!errorCode && response.status === 403) {
    errorCode = 'access_pending';
  }
  throw new AuthRequestError(message, errorCode);
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

    const refreshUrl = new URL(`${backendUrl}/api/v1/token`);
    refreshUrl.searchParams.set('grant_type', 'refresh_token');
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
    return buildSessionFromTokenPayload(payload, nowSeconds);
  };

  return {
    type: 'shellui',
    readSessionFromCallback: (locationHash, nowSeconds) => {
      const hashParams = new URLSearchParams(locationHash.replace(/^#/, ''));
      return buildSessionFromParams(hashParams, nowSeconds);
    },
    exchangeOAuthSessionCode: async ({ authCode, redirectTo, nowSeconds }) => {
      if (!backendUrl) {
        throw new Error('Missing Shellui backend URL.');
      }
      const response = await fetch(`${backendUrl}${OAUTH_SESSION_ENDPOINT}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_code: authCode,
          redirect_to: redirectTo,
        }),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        parseAuthErrorPayload(payload, response);
      }
      return buildSessionFromTokenPayload(payload, nowSeconds);
    },
    exchangeOAuthCode: async ({ provider, code, redirectUri, oauthClientId, nowSeconds }) => {
      if (!backendUrl) {
        throw new Error('Missing Shellui backend URL.');
      }
      const selectedCompanyId = getShellUILoginCompanyId(companyId);
      if (!selectedCompanyId) {
        throw new Error('Missing company_id for OAuth exchange.');
      }
      const endpoint = new URL(`${backendUrl}${OAUTH_EXCHANGE_ENDPOINT}`);
      endpoint.searchParams.set('company_id', selectedCompanyId);
      const clientTz = getShellUILoginClientTimezone();
      const clientDeviceId = getShellUILoginDeviceId();
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          code,
          redirect_uri: redirectUri,
          ...(typeof oauthClientId === 'number' &&
          Number.isFinite(oauthClientId) &&
          oauthClientId > 0
            ? { company_oauth_client_id: Math.trunc(oauthClientId) }
            : {}),
          ...(clientTz ? { client_timezone: clientTz } : {}),
          ...(clientDeviceId ? { client_device_id: clientDeviceId } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        parseAuthErrorPayload(payload, response);
      }
      return buildSessionFromTokenPayload(payload, nowSeconds);
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
        throw new Error('Missing Shellui backend URL.');
      }
      const redirectToUrl = new URL(
        `${window.location.origin}${normalizeRedirectPath(redirectPath)}`,
      );
      redirectToUrl.searchParams.set('provider', provider);
      if (
        typeof oauthClientId === 'number' &&
        Number.isFinite(oauthClientId) &&
        oauthClientId > 0
      ) {
        redirectToUrl.searchParams.set(
          'company_oauth_client_id',
          String(Math.trunc(oauthClientId)),
        );
      }
      const redirectTo = redirectToUrl.toString();
      const authorizeUrl = new URL(`${backendUrl}/api/v1/authorize`);
      authorizeUrl.searchParams.set('provider', provider);
      authorizeUrl.searchParams.set('redirect_to', redirectTo);
      if (
        typeof oauthClientId === 'number' &&
        Number.isFinite(oauthClientId) &&
        oauthClientId > 0
      ) {
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
      const endpoint = new URL(`${backendUrl}/api/v1/logout`);
      await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          ...(session.refreshToken ? { refresh_token: session.refreshToken } : {}),
        }),
      });
    },
    supportsAccountDeletion: true,
    deleteAccount: async (session) => {
      if (!backendUrl) {
        throw new Error('Missing Shellui backend URL.');
      }
      if (!session?.accessToken) {
        throw new AuthRequestError(
          'Sign in again, then delete your account.',
          'recent_login_required',
        );
      }
      // Company comes from the access token so only the current company is affected.
      const response = await fetch(`${backendUrl}${USER_ENDPOINT}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          confirm: true,
          ...(session.refreshToken ? { refresh_token: session.refreshToken } : {}),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        const err = payload?.error ?? payload?.detail;
        const message =
          typeof err === 'string' && err.trim()
            ? err
            : `Could not delete account (HTTP ${response.status}).`;
        const errorCode =
          typeof payload?.error_code === 'string' ? payload.error_code.trim() || null : null;
        throw new AuthRequestError(message, errorCode, payload ?? undefined);
      }
    },
    supportsProfileUpdate: true,
    updateProfile: async (session, { name }) => {
      if (!backendUrl) {
        throw new Error('Missing Shellui backend URL.');
      }
      if (!session?.accessToken) {
        throw new AuthRequestError('Sign in again, then update your name.', 'unauthorized');
      }
      const response = await fetch(`${backendUrl}${USER_ENDPOINT}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        const fieldErrors = Array.isArray(payload?.name) ? payload.name : [];
        const err = payload?.error ?? payload?.detail ?? fieldErrors[0];
        const message =
          typeof err === 'string' && err.trim()
            ? err
            : `Could not update name (HTTP ${response.status}).`;
        throw new AuthRequestError(message, null, payload ?? undefined);
      }
      const metadata = payload?.user_metadata as Record<string, unknown> | undefined;
      const savedName = typeof metadata?.name === 'string' ? metadata.name : name;
      return { name: savedName };
    },
    getAuthSettings: async () => {
      if (!backendUrl) {
        return { methods: [], oauthProviders: [], oauthClients: [] };
      }
      const endpoint = new URL(`${backendUrl}/api/v1/settings`);
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
    sendMagicLink: async (email, redirectPath, options) => {
      if (!backendUrl) {
        throw new Error('Missing Shellui backend URL.');
      }
      const selectedCompanyId = getShellUILoginCompanyId(companyId);
      if (!selectedCompanyId) {
        throw new Error('Missing company_id for magic link request.');
      }
      const redirectTo = `${window.location.origin}${normalizeRedirectPath(redirectPath)}`;
      const clientTz = getShellUILoginClientTimezone();
      const clientDeviceId = getShellUILoginDeviceId();
      const language = options?.language?.trim();
      const response = await fetch(`${backendUrl}${MAGIC_LINK_REQUEST_ENDPOINT}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: Number(selectedCompanyId),
          email,
          redirect_to: redirectTo,
          ...(clientTz ? { client_timezone: clientTz } : {}),
          ...(clientDeviceId ? { client_device_id: clientDeviceId } : {}),
          ...(language ? { language } : {}),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        const err = payload?.error ?? payload?.detail;
        const message =
          typeof err === 'string' && err.trim()
            ? err
            : `Could not send magic link (HTTP ${response.status}).`;
        const errorCode =
          typeof payload?.error_code === 'string' ? payload.error_code.trim() || null : null;
        throw new AuthRequestError(message, errorCode);
      }
    },
    syncUserPreferences: async (session, preferences: UserPreferences) => {
      if (!backendUrl || !session?.accessToken) {
        return;
      }
      const endpoint = new URL(`${backendUrl}${USER_PREFERENCES_ENDPOINT}`);
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
