import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { useConfig } from '../config/useConfig';
import { useAuth } from './useAuth';

type LoginMethod = 'password' | 'oauth' | 'magic_link';

interface AuthSettings {
  methods: LoginMethod[];
  oauthProviders: string[];
}

const NON_OAUTH_EXTERNAL_PROVIDERS = new Set(['email', 'phone', 'sms']);

const isLoginMethod = (value: unknown): value is LoginMethod =>
  value === 'password' || value === 'oauth' || value === 'magic_link';

const formatProviderLabel = (provider: string) => {
  if (provider.toLowerCase() === 'github') return 'GitHub';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const normalizeAuthSettings = (payload: unknown): AuthSettings => {
  const record = Array.isArray(payload) ? payload[0] : payload;
  if (!record || typeof record !== 'object') {
    return { methods: [], oauthProviders: [] };
  }

  const obj = record as Record<string, unknown>;
  const methodsFromArray = Array.isArray(obj.methods)
    ? obj.methods.filter(isLoginMethod)
    : [];
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
  if (typeof obj.oauth_provider === 'string') oauthProvidersSet.add(obj.oauth_provider.toLowerCase());

  return {
    methods: Array.from(methods),
    oauthProviders: Array.from(oauthProvidersSet),
  };
};

export const LoginView = () => {
  const navigate = useNavigate();
  const { config } = useConfig();
  const {
    session,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    authEvent,
    clearAuthEvent,
    startSupabaseOAuth,
    logout,
  } = useAuth();

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AuthSettings>({ methods: [], oauthProviders: [] });
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

  const backendUrl = config.backend?.url?.replace(/\/+$/, '') ?? null;
  const publishableKey = config.backend?.publishableKey;
  const endpoint = useMemo(() => {
    if (!backendUrl) return null;
    if (config.backend?.type === 'supabase') {
      const url = new URL(`${backendUrl}/auth/v1/settings`);
      if (publishableKey) {
        url.searchParams.set('apikey', publishableKey);
      }
      return url.toString();
    }
    return `${backendUrl}/auth/settings`;
  }, [backendUrl, config.backend?.type, publishableKey]);

  useEffect(() => {
    if (authEvent === 'oauth_callback' && isAuthenticated) {
      clearAuthEvent();
      navigate('/', { replace: true });
    }
  }, [authEvent, clearAuthEvent, isAuthenticated, navigate]);

  useEffect(() => {
    if (!endpoint || isAuthenticated) {
      setSettingsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadAuthSettings = async () => {
      try {
        setSettingsLoading(true);
        setSettingsError(null);

        const headers: HeadersInit = { Accept: 'application/json' };
        if (publishableKey) {
          headers.apikey = publishableKey;
          headers.Authorization = `Bearer ${publishableKey}`;
        }

        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!cancelled) {
          setSettings(normalizeAuthSettings(payload));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load auth settings.';
          setSettingsError(message);
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    };

    void loadAuthSettings();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [endpoint, isAuthenticated, publishableKey]);

  const supportsOAuth = settings.methods.includes('oauth');
  const supportsMagicLink = settings.methods.includes('magic_link');
  const pageError = authError ?? settingsError ?? magicLinkError;

  const handleOAuthLogin = (provider: string) => {
    setOauthLoadingProvider(provider);
    startSupabaseOAuth(provider);
  };

  const handleMagicLinkLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = magicLinkEmail.trim();
    if (!email) {
      setMagicLinkError('Please enter your email address.');
      setMagicLinkMessage(null);
      return;
    }
    if (!backendUrl || config.backend?.type !== 'supabase' || !publishableKey) {
      setMagicLinkError('Missing Supabase backend URL or publishableKey.');
      setMagicLinkMessage(null);
      return;
    }

    setMagicLinkLoading(true);
    setMagicLinkError(null);
    setMagicLinkMessage(null);

    try {
      const otpUrl = new URL(`${backendUrl}/auth/v1/otp`);
      otpUrl.searchParams.set('apikey', publishableKey);
      const emailRedirectTo = `${window.location.origin}/login`;

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
        const payload = (await response.json().catch(() => null)) as
          | { msg?: string; message?: string; error_description?: string }
          | null;
        throw new Error(
          payload?.msg ??
            payload?.message ??
            payload?.error_description ??
            `Could not send magic link (HTTP ${response.status}).`,
        );
      }

      setMagicLinkMessage('Check your inbox for a magic login link.');
    } catch (err) {
      setMagicLinkError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-foreground">Login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in using OAuth or a magic link sent to your email.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        {isAuthenticated && session && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3">
              {session.userAvatarUrl && (
                <img
                  src={session.userAvatarUrl}
                  alt={session.userName ? `${session.userName} avatar` : 'User avatar'}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <p className="text-sm text-foreground">
                Signed in
                {session.userName ? ` as ${session.userName}` : ''}
                {session.userEmail ? ` (${session.userEmail})` : ''}.
              </p>
            </div>
            <Button type="button" variant="secondary" className="w-full" onClick={() => void logout()}>
              Logout
            </Button>
          </div>
        )}

        {!isAuthenticated && (authLoading || settingsLoading) && (
          <p className="text-sm text-muted-foreground">Loading auth settings...</p>
        )}

        {!authLoading && !settingsLoading && pageError && (
          <p className="text-sm text-destructive">
            Could not load auth settings: {pageError}
            {endpoint ? ` (${endpoint})` : ''}
          </p>
        )}

        {!authLoading && !settingsLoading && !pageError && !isAuthenticated && (
          <div className="space-y-3">
            {supportsOAuth && (
              <div className="space-y-2">
                {settings.oauthProviders.map((provider) => (
                  <Button
                    key={provider}
                    type="button"
                    className="w-full"
                    onClick={() => handleOAuthLogin(provider)}
                    disabled={oauthLoadingProvider === provider}
                  >
                    {oauthLoadingProvider === provider
                      ? `Redirecting to ${formatProviderLabel(provider)}...`
                      : `Continue with ${formatProviderLabel(provider)}`}
                  </Button>
                ))}
                {settings.oauthProviders.length === 0 && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => handleOAuthLogin('github')}
                    disabled={oauthLoadingProvider === 'github'}
                  >
                    {oauthLoadingProvider === 'github'
                      ? 'Redirecting to GitHub...'
                      : 'Continue with GitHub'}
                  </Button>
                )}
                {!publishableKey && (
                  <p className="text-sm text-destructive">
                    Add `backend.publishableKey` in config to enable OAuth redirect.
                  </p>
                )}
              </div>
            )}

            {supportsMagicLink && (
              <form className="space-y-2" onSubmit={(event) => void handleMagicLinkLogin(event)}>
                <input
                  type="email"
                  value={magicLinkEmail}
                  onChange={(event) => setMagicLinkEmail(event.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button type="submit" variant="secondary" className="w-full" disabled={magicLinkLoading}>
                  {magicLinkLoading ? 'Sending magic link...' : 'Send magic link'}
                </Button>
                {magicLinkMessage && <p className="text-sm text-muted-foreground">{magicLinkMessage}</p>}
              </form>
            )}

            {!supportsOAuth && !supportsMagicLink && (
              <p className="text-sm text-muted-foreground">
                No login method is currently enabled in backend auth settings.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
