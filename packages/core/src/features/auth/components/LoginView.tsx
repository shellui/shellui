import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import urls from '../../../constants/urls';
import { useConfig } from '../../config/useConfig';
import { useAuth } from '../hooks/useAuth';
import type { AuthSettings, LoginMethod } from '../types';
import {
  formatProviderLabel,
  getOAuthProviderCandidates,
  getPreferredBackendProvider,
  getProviderVisual,
  isLoginMethod,
  normalizeNextPath,
} from '../utils';

export const LoginView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useConfig();
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    authEvent,
    clearAuthEvent,
    startOAuth,
    getAuthSettings,
    sendMagicLink,
  } = useAuth();
  const configuredSettings = useMemo<AuthSettings>(() => {
    const configuredMethods = Array.isArray(config.backend?.login?.methods)
      ? config.backend.login.methods.filter(isLoginMethod)
      : [];
    const configuredProvidersRaw = Array.isArray(config.backend?.login?.oauthProviders)
      ? config.backend.login.oauthProviders
          .filter(
            (provider): provider is string =>
              typeof provider === 'string' && provider.trim() !== '',
          )
          .map((provider) => provider.toLowerCase())
      : [];
    const configuredProviders = Array.from(new Set(configuredProvidersRaw));
    return {
      methods: configuredMethods,
      oauthProviders: configuredProviders,
    };
  }, [config.backend?.login?.methods, config.backend?.login?.oauthProviders]);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
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

  const supportsOAuth = configuredSettings.methods.includes('oauth');
  const supportsMagicLink = configuredSettings.methods.includes('magic_link');
  const settingsLoadError = authError ?? methodError;
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

  const verifyMethodSupport = useCallback(
    async (
      method: LoginMethod,
      provider?: string,
    ): Promise<{ isSupported: boolean; backendProvider?: string }> => {
      try {
        const backendSettings = await getAuthSettings();
        if (!backendSettings.methods.includes(method)) {
          const humanMethod = method === 'magic_link' ? 'magic link' : method;
          setMethodError(`This backend does not support ${humanMethod} login.`);
          return { isSupported: false };
        }
        if (method === 'oauth' && provider && backendSettings.oauthProviders.length > 0) {
          const requestedCandidates = getOAuthProviderCandidates(provider);
          const availableProviders = backendSettings.oauthProviders.map((p) => p.toLowerCase());
          const matchedProvider = requestedCandidates.find((candidate) =>
            availableProviders.includes(candidate),
          );
          if (!matchedProvider) {
            setMethodError(
              `This backend does not support OAuth with ${formatProviderLabel(provider)}.`,
            );
            return { isSupported: false };
          }
          return { isSupported: true, backendProvider: matchedProvider };
        }
        if (method === 'oauth' && provider) {
          return {
            isSupported: true,
            backendProvider: getPreferredBackendProvider(provider),
          };
        }
        return { isSupported: true };
      } catch (err) {
        setMethodError(
          err instanceof Error ? err.message : 'Could not verify backend login capabilities.',
        );
        return { isSupported: false };
      }
    },
    [getAuthSettings],
  );

  const handleOAuthLogin = async (provider: string) => {
    setMethodError(null);
    setMagicLinkError(null);
    setMagicLinkMessage(null);
    setOauthLoadingProvider(provider);
    const support = await verifyMethodSupport('oauth', provider);
    if (!support.isSupported) {
      setOauthLoadingProvider(null);
      return;
    }
    const backendProvider = support.backendProvider ?? getPreferredBackendProvider(provider);
    if (typeof window !== 'undefined' && window.parent !== window) {
      shellui.login({
        method: 'oauth',
        provider: backendProvider,
        redirectPath: loginPathWithNext,
      });
      return;
    }
    const started = startOAuth(backendProvider, loginPathWithNext);
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
      setMethodError(null);
      return;
    }
    setMagicLinkLoading(true);
    setMagicLinkError(null);
    setMagicLinkMessage(null);
    setMethodError(null);

    try {
      const support = await verifyMethodSupport('magic_link');
      if (!support.isSupported) {
        return;
      }
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
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center p-6">
      <h1 className="text-center text-2xl font-semibold text-foreground">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{signInDescription}</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        {settingsLoadError && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {settingsLoadError}
          </p>
        )}

        <div className="space-y-4">
          {supportsOAuth && (
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Social login
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {configuredSettings.oauthProviders.map((provider) => {
                  const visual = getProviderVisual(provider);
                  const label = formatProviderLabel(provider);
                  return (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-start px-3"
                      onClick={() => void handleOAuthLogin(provider)}
                      disabled={isActionPending}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${visual.iconClassName}`}
                        aria-hidden
                      >
                        {visual.iconText}
                      </span>
                      <span className="truncate">
                        {oauthLoadingProvider === provider
                          ? `Redirecting to ${label}...`
                          : `Continue with ${label}`}
                      </span>
                    </Button>
                  );
                })}
                {configuredSettings.oauthProviders.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start px-3"
                    onClick={() => void handleOAuthLogin('github')}
                    disabled={isActionPending}
                  >
                    <span
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#24292F] text-[10px] font-semibold text-white"
                      aria-hidden
                    >
                      GH
                    </span>
                    <span>
                      {oauthLoadingProvider === 'github'
                        ? 'Redirecting to GitHub...'
                        : 'Continue with GitHub'}
                    </span>
                  </Button>
                )}
              </div>
            </section>
          )}

          {supportsOAuth && supportsMagicLink && (
            <div className="relative py-1">
              <div className="border-t border-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>
          )}

          {supportsMagicLink && (
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email magic link
              </p>
              <form
                className="space-y-2"
                onSubmit={(event) => void handleMagicLinkLogin(event)}
              >
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
            </section>
          )}

          {!supportsOAuth && !supportsMagicLink && (
            <p className="text-sm text-muted-foreground">
              No login method is currently enabled in backend auth settings.
            </p>
          )}
        </div>
      </div>
    </main>
  );
};
