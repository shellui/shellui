import type { AuthSession, AuthSettings, LoginMethod } from '../types';
import type { AuthBackend } from './types';

const NON_OAUTH_EXTERNAL_PROVIDERS = new Set(['email', 'phone', 'sms']);

const isLoginMethod = (value: unknown): value is LoginMethod =>
  value === 'password' || value === 'oauth' || value === 'magic_link';

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

const normalizeAuthSettings = (payload: unknown): AuthSettings => {
  const record = Array.isArray(payload) ? payload[0] : payload;
  if (!record || typeof record !== 'object') {
    return { methods: [], oauthProviders: [] };
  }

  const obj = record as Record<string, unknown>;
  const methodsFromArray = Array.isArray(obj.methods) ? obj.methods.filter(isLoginMethod) : [];
  const methods = new Set<LoginMethod>(methodsFromArray);
  const oauthProvidersSet = new Set<string>();

  if (isLoginMethod(obj.loginMethod)) methods.add(obj.loginMethod);
  if (obj.loginMethod === 'both') {
    methods.add('password');
    methods.add('oauth');
  }
  if (obj.enable_password === true) methods.add('password');
  if (obj.enable_oauth === true) methods.add('oauth');
  if (obj.enable_magic_link === true) methods.add('magic_link');

  if (obj.external && typeof obj.external === 'object') {
    const external = obj.external as Record<string, unknown>;
    const enabledProviders = Object.entries(external)
      .filter(([, enabled]) => enabled === true)
      .map(([provider]) => provider);
    if (enabledProviders.length > 0) methods.add('oauth');
    enabledProviders
      .filter((provider) => !NON_OAUTH_EXTERNAL_PROVIDERS.has(provider.toLowerCase()))
      .forEach((provider) => oauthProvidersSet.add(provider.toLowerCase()));
    if (external.email === true || obj.disable_signup === false) methods.add('magic_link');
  }

  if (Array.isArray(obj.oauthProviders)) {
    obj.oauthProviders
      .filter((provider): provider is string => typeof provider === 'string')
      .forEach((provider) => oauthProvidersSet.add(provider.toLowerCase()));
  }
  if (typeof obj.oauth_provider === 'string') {
    oauthProvidersSet.add(obj.oauth_provider.toLowerCase());
  }

  return {
    methods: Array.from(methods),
    oauthProviders: Array.from(oauthProvidersSet),
  };
};

const isExpired = (session: AuthSession) => session.expiresAt <= Math.floor(Date.now() / 1000) + 30;

const normalizeRedirectPath = (redirectPath: string) =>
  redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;

export const createSupabaseAuthBackend = ({
  backendUrl,
  publishableKey,
}: {
  backendUrl: string | null;
  publishableKey: string | undefined;
}): AuthBackend => ({
  type: 'supabase',
  readSessionFromCallback: (locationHash, nowSeconds) => {
    const hashParams = new URLSearchParams(locationHash.replace(/^#/, ''));
    return buildSessionFromParams(hashParams, nowSeconds);
  },
  restoreSession: async (storedSession, nowSeconds) => {
    if (!storedSession) return null;
    if (!isExpired(storedSession)) return storedSession;
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
});
