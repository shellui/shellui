import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import urls from '../../../constants/urls';
import { useAuth } from '../hooks/useAuth';
import type { AuthSettings } from '../types';

const formatProviderLabel = (provider: string) => {
  if (provider.toLowerCase() === 'github') return 'GitHub';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const normalizeNextPath = (value: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value === urls.login || value.startsWith(`${urls.login}?`)) return null;
  return value;
};

export const LoginView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    session,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    authEvent,
    clearAuthEvent,
    startOAuth,
    getAuthSettings,
    sendMagicLink,
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
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNextPath(params.get('next')) ?? '/';
  }, [location.search]);
  const loginPathWithNext = useMemo(() => {
    return `${urls.login}?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

  useEffect(() => {
    if (authEvent === 'oauth_callback' && isAuthenticated) {
      clearAuthEvent();
      navigate(nextPath, { replace: true });
    }
  }, [authEvent, clearAuthEvent, isAuthenticated, navigate, nextPath]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, nextPath]);

  useEffect(() => {
    if (isAuthenticated) {
      setSettingsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadAuthSettings = async () => {
      try {
        setSettingsLoading(true);
        setSettingsError(null);
        if (!cancelled) {
          const nextSettings = await getAuthSettings();
          if (!controller.signal.aborted) {
            setSettings(nextSettings);
          }
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
  }, [getAuthSettings, isAuthenticated]);

  const supportsOAuth = settings.methods.includes('oauth');
  const supportsMagicLink = settings.methods.includes('magic_link');
  const settingsLoadError = authError ?? settingsError;
  const isActionPending = Boolean(oauthLoadingProvider) || magicLinkLoading;
  const signInDescription = useMemo(() => {
    if (supportsOAuth && supportsMagicLink) {
      return 'Continue with your identity provider or request a secure sign-in link by email.';
    }
    if (supportsOAuth) {
      return 'Continue with your configured identity provider.';
    }
    if (supportsMagicLink) {
      return 'Enter your email to receive a secure sign-in link.';
    }
    return 'No sign-in method is currently available.';
  }, [supportsMagicLink, supportsOAuth]);

  const handleOAuthLogin = (provider: string) => {
    setOauthLoadingProvider(provider);
    if (typeof window !== 'undefined' && window.parent !== window) {
      shellui.login({
        method: 'oauth',
        provider,
        redirectPath: loginPathWithNext,
      });
      return;
    }
    const started = startOAuth(provider, loginPathWithNext);
    if (!started) {
      setOauthLoadingProvider(null);
    }
  };

  const handleMagicLinkLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = magicLinkEmail.trim();
    if (!email) {
      setMagicLinkError('Please enter your email address.');
      setMagicLinkMessage(null);
      return;
    }
    setMagicLinkLoading(true);
    setMagicLinkError(null);
    setMagicLinkMessage(null);

    try {
      await sendMagicLink(email, loginPathWithNext);
      setMagicLinkMessage('Check your inbox for a magic login link.');
    } catch (err) {
      setMagicLinkError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">{signInDescription}</p>

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
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        )}

        {!isAuthenticated && (authLoading || settingsLoading) && (
          <p className="text-sm text-muted-foreground">Loading auth settings...</p>
        )}

        {!authLoading && !settingsLoading && settingsLoadError && (
          <p className="text-sm text-destructive">
            Unable to load sign-in settings. Please try again in a moment.
          </p>
        )}

        {!authLoading && !settingsLoading && !settingsLoadError && !isAuthenticated && (
          <div className="space-y-3">
            {supportsOAuth && (
              <div className="space-y-2">
                {settings.oauthProviders.map((provider) => (
                  <Button
                    key={provider}
                    type="button"
                    className="w-full"
                    onClick={() => handleOAuthLogin(provider)}
                    disabled={isActionPending}
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
                    disabled={isActionPending}
                  >
                    {oauthLoadingProvider === 'github'
                      ? 'Redirecting to GitHub...'
                      : 'Continue with GitHub'}
                  </Button>
                )}
              </div>
            )}

            {supportsMagicLink && (
              <form
                className="space-y-2"
                onSubmit={(event) => void handleMagicLinkLogin(event)}
              >
                <label
                  htmlFor="magic-link-email"
                  className="text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="magic-link-email"
                  type="email"
                  value={magicLinkEmail}
                  onChange={(event) => setMagicLinkEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={isActionPending}
                >
                  {magicLinkLoading ? 'Sending magic link...' : 'Send magic link'}
                </Button>
                {magicLinkMessage && (
                  <p className="text-sm text-muted-foreground">{magicLinkMessage}</p>
                )}
                {magicLinkError && <p className="text-sm text-destructive">{magicLinkError}</p>}
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
