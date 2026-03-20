import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import urls from '../../../constants/urls';
import { cn } from '../../../lib/utils';
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

const LAST_USED_LOGIN_STORAGE_KEY = 'shellui.auth.last_used_login';

type LastUsedLogin = { method: 'oauth'; provider: string } | { method: 'magic_link' };

const readLastUsedLoginFromStorage = (): LastUsedLogin | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_USED_LOGIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { method?: string; provider?: string };
    if (parsed.method === 'magic_link') {
      return { method: 'magic_link' };
    }
    if (parsed.method === 'oauth' && typeof parsed.provider === 'string' && parsed.provider.trim()) {
      return { method: 'oauth', provider: parsed.provider.toLowerCase() };
    }
  } catch {
    // Ignore malformed data and fallback to default ordering.
  }
  return null;
};

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

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
  const [lastUsedLogin, setLastUsedLogin] = useState<LastUsedLogin | null>(
    readLastUsedLoginFromStorage,
  );
  const [showAlternativeMethods, setShowAlternativeMethods] = useState(false);
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
  const allOAuthProviders = useMemo(
    () =>
      configuredSettings.oauthProviders.length > 0 ? configuredSettings.oauthProviders : ['github'],
    [configuredSettings.oauthProviders],
  );
  const lastUsedOauthProvider = useMemo(() => {
    if (!supportsOAuth || !lastUsedLogin || lastUsedLogin.method !== 'oauth') return null;
    const provider = lastUsedLogin.provider.toLowerCase();
    return allOAuthProviders.includes(provider) ? provider : null;
  }, [allOAuthProviders, lastUsedLogin, supportsOAuth]);
  const featuredMethod =
    supportsMagicLink && lastUsedLogin?.method === 'magic_link'
      ? 'magic_link'
      : supportsOAuth && lastUsedOauthProvider
        ? 'oauth'
        : null;
  const isIframeView = typeof window !== 'undefined' && window.parent !== window;
  const featuredOAuthProvider = featuredMethod === 'oauth' ? lastUsedOauthProvider : null;
  const otherOAuthProviders = useMemo(() => {
    if (!supportsOAuth) return [];
    if (!featuredOAuthProvider) return allOAuthProviders;
    return allOAuthProviders.filter((provider) => provider !== featuredOAuthProvider);
  }, [allOAuthProviders, featuredOAuthProvider, supportsOAuth]);
  const hasAlternativeMethods = useMemo(() => {
    if (featuredMethod === 'oauth') {
      return otherOAuthProviders.length > 0 || supportsMagicLink;
    }
    if (featuredMethod === 'magic_link') {
      return supportsOAuth && otherOAuthProviders.length > 0;
    }
    return false;
  }, [featuredMethod, otherOAuthProviders.length, supportsMagicLink, supportsOAuth]);
  const showAlternatives = featuredMethod === null || showAlternativeMethods;
  const alternativesAreCollapsible = featuredMethod !== null && hasAlternativeMethods;
  useEffect(() => {
    if (featuredMethod !== null) {
      setShowAlternativeMethods(false);
    }
  }, [featuredMethod]);
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
    const rememberedLogin: LastUsedLogin = { method: 'oauth', provider: provider.toLowerCase() };
    setLastUsedLogin(rememberedLogin);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_USED_LOGIN_STORAGE_KEY, JSON.stringify(rememberedLogin));
    }
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
      const rememberedLogin: LastUsedLogin = { method: 'magic_link' };
      setLastUsedLogin(rememberedLogin);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_USED_LOGIN_STORAGE_KEY, JSON.stringify(rememberedLogin));
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
    <main className="flex min-h-full w-full bg-background">
      {!isIframeView && <section className="hidden w-1/2 bg-muted/40 md:block" aria-hidden />}

      <section
        className={cn(
          'flex min-h-full w-full items-center justify-center px-6 py-10',
          !isIframeView && 'md:w-1/2',
        )}
      >
        <div
          className={cn(
            'w-full max-w-xl space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500',
            isIframeView ? 'max-w-2xl' : '',
          )}
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">{signInDescription}</p>
          </div>

          {settingsLoadError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {settingsLoadError}
            </p>
          )}

          <div className="space-y-4">
            {featuredMethod === 'oauth' && featuredOAuthProvider && (
              <section className="space-y-2 rounded-2xl bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last used
                </p>
                {(() => {
                  const visual = getProviderVisual(featuredOAuthProvider);
                  const label = formatProviderLabel(featuredOAuthProvider);
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-start px-3 text-base"
                      onClick={() => void handleOAuthLogin(featuredOAuthProvider)}
                      disabled={isActionPending}
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                        <visual.Icon className={cn('h-3 w-3', visual.iconClassName)} />
                      </span>
                      <span className="truncate">
                        {oauthLoadingProvider === featuredOAuthProvider
                          ? `Redirecting to ${label}...`
                          : `Continue with ${label}`}
                      </span>
                    </Button>
                  );
                })()}
              </section>
            )}

            {featuredMethod === 'magic_link' && supportsMagicLink && (
              <section className="space-y-2 rounded-2xl bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last used
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

            {featuredMethod !== null && hasAlternativeMethods && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAlternativeMethods}
                  className="h-8 w-auto justify-start gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAlternativeMethods((prev) => !prev)}
                >
                  <ChevronDownIcon
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-300',
                      showAlternativeMethods ? 'rotate-180' : 'rotate-0',
                    )}
                  />
                  {showAlternativeMethods ? 'Hide other methods' : 'Use another method'}
                </Button>
              </div>
            )}

            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-500 ease-out',
                alternativesAreCollapsible
                  ? showAlternatives
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    'space-y-4 transition-transform duration-500 ease-out',
                    alternativesAreCollapsible && !showAlternatives
                      ? '-translate-y-2'
                      : 'translate-y-0',
                  )}
                >
                  {featuredMethod === 'oauth' &&
                    (otherOAuthProviders.length > 0 || supportsMagicLink) && (
                    <div className="relative py-1">
                      <div className="border-t border-border" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                        or
                      </span>
                    </div>
                  )}

                  {featuredMethod === 'magic_link' && supportsOAuth && (
                    <div className="relative py-1">
                      <div className="border-t border-border" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                        or
                      </span>
                    </div>
                  )}

                  {supportsOAuth && otherOAuthProviders.length > 0 && (
                    <section className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {featuredMethod === 'oauth' ? 'Other social logins' : 'Social login'}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {otherOAuthProviders.map((provider) => {
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
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                                <visual.Icon className={cn('h-3 w-3', visual.iconClassName)} />
                              </span>
                              <span className="truncate">
                                {oauthLoadingProvider === provider
                                  ? `Redirecting to ${label}...`
                                  : `Continue with ${label}`}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {supportsOAuth && supportsMagicLink && featuredMethod !== 'magic_link' && (
                    <div className="relative py-1">
                      <div className="border-t border-border" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                        or
                      </span>
                    </div>
                  )}

                  {supportsMagicLink && featuredMethod !== 'magic_link' && (
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
                        {magicLinkError && (
                          <p className="text-sm text-destructive">{magicLinkError}</p>
                        )}
                      </form>
                    </section>
                  )}
                </div>
              </div>
            </div>

            {!supportsOAuth && !supportsMagicLink && (
              <p className="text-sm text-muted-foreground">
                No login method is currently enabled in backend auth settings.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
