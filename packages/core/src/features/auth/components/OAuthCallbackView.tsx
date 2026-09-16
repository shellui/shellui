import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import urls from '../../../constants/urls';
import {
  buildAuthUrlWithNext,
  captureCliCallbackFromSearch,
  hashHasOAuthTokens,
  inferAccessPendingErrorCode,
  isAccessPendingErrorCode,
  normalizeNextPath,
  redirectCliCallbackError,
  redirectToCliCallback,
} from '../utils';
import { useAuth } from '../hooks/useAuth';
import { AccessPendingView } from './AccessPendingView';

const SHELLUI_OAUTH_ERROR_PARAM = 'shellui_oauth_error';
const SHELLUI_OAUTH_ERROR_CODE_PARAM = 'shellui_oauth_error_code';
const PENDING_STORAGE_PREFIX = 'shellui.oauth.access_pending:';

const toPositiveInt = (raw: string | null): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
};

type PendingAccess = { message: string; code: string };

const readPendingForCode = (code: string): PendingAccess | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${PENDING_STORAGE_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { message?: unknown; code?: unknown };
    if (typeof parsed.message === 'string' && typeof parsed.code === 'string') {
      return { message: parsed.message, code: parsed.code };
    }
  } catch {
    // ignore
  }
  return null;
};

const writePendingForCode = (oauthCode: string, pending: PendingAccess) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${PENDING_STORAGE_PREFIX}${oauthCode}`, JSON.stringify(pending));
  } catch {
    // ignore
  }
};

const clearPendingForCode = (oauthCode: string) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${PENDING_STORAGE_PREFIX}${oauthCode}`);
  } catch {
    // ignore
  }
};

const buildLoginPendingUrl = (nextPath: string, pending: PendingAccess) => {
  const loginUrl = new URL(buildAuthUrlWithNext(urls.login, nextPath), window.location.origin);
  loginUrl.searchParams.set(SHELLUI_OAUTH_ERROR_PARAM, pending.message.slice(0, 500));
  loginUrl.searchParams.set(SHELLUI_OAUTH_ERROR_CODE_PARAM, pending.code);
  return `${loginUrl.pathname}${loginUrl.search}`;
};

const looksLikeUsedOAuthCode = (message: string | null | undefined) => {
  const text = (message || '').toLowerCase();
  return (
    text.includes('bad_verification_code') ||
    text.includes('code has already been used') ||
    text.includes('authorization code was already redeemed') ||
    text.includes('invalid_grant') ||
    text.includes('expired') ||
    text.includes('redirect_uri')
  );
};

export const OAuthCallbackView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthCallback, isAuthenticated, isLoading, session } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState<PendingAccess | null>(null);
  const [isWorking, setIsWorking] = useState(true);
  /** OAuth `code` we already started exchanging (avoid double-spend / Strict Mode races). */
  const startedCodeRef = useRef<string | null>(null);
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNextPath(params.get('next')) ?? '/';
  }, [location.search]);
  const fragmentHasTokens = useMemo(() => hashHasOAuthTokens(location.hash), [location.hash]);

  useEffect(() => {
    captureCliCallbackFromSearch(location.search);
  }, [location.search]);

  useEffect(() => {
    if (!isAuthenticated || !session) return;
    if (redirectToCliCallback(session)) return;
    navigate(nextPath, { replace: true });
  }, [isAuthenticated, navigate, nextPath, session]);

  useEffect(() => {
    if (isAuthenticated) return;
    // Identity bounce lands with tokens in the hash; AuthProvider restores the session.
    // Stay on "Completing…" while hash is present or auth bootstrap is still running.
    if (fragmentHasTokens || isLoading) {
      setIsWorking(true);
      setLocalError(null);
      return;
    }

    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      if (redirectCliCallbackError(oauthError)) return;
      setLocalError(oauthError);
      setIsWorking(false);
      return;
    }

    const bounceError = params.get(SHELLUI_OAUTH_ERROR_PARAM);
    if (bounceError) {
      const bounceCode = params.get(SHELLUI_OAUTH_ERROR_CODE_PARAM) || 'oauth_error';
      if (redirectCliCallbackError(bounceError, bounceCode)) return;
      if (isAccessPendingErrorCode(bounceCode)) {
        setPendingAccess({ message: bounceError, code: bounceCode });
        setIsWorking(false);
        return;
      }
      setLocalError(bounceError);
      setIsWorking(false);
      return;
    }

    const code = params.get('code');
    const provider = params.get('provider');
    if (!code || !provider) {
      const message = 'Missing OAuth callback parameters.';
      if (redirectCliCallbackError(message)) return;
      setLocalError(message);
      setIsWorking(false);
      return;
    }

    // If a previous attempt already learned this login is pending, show it without re-exchanging.
    const cachedPending = readPendingForCode(code);
    if (cachedPending) {
      if (redirectCliCallbackError(cachedPending.message, cachedPending.code)) return;
      setPendingAccess(cachedPending);
      setIsWorking(false);
      navigate(buildLoginPendingUrl(nextPath, cachedPending), { replace: true });
      return;
    }

    if (startedCodeRef.current === code) {
      return;
    }
    startedCodeRef.current = code;

    let cancelled = false;
    const run = async () => {
      const redirectUri = `${window.location.origin}${location.pathname}${location.search}`;
      let result: { ok: boolean; error?: string | null; errorCode?: string | null };
      try {
        result = await completeOAuthCallback({
          provider,
          code,
          redirectUri,
          oauthClientId: toPositiveInt(params.get('company_oauth_client_id')),
        });
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to complete OAuth login.',
          errorCode: null,
        };
      }

      // Always apply UI state — do not drop failures when the effect cleans up
      // (Strict Mode / callback identity changes), or the page stays on "Completing…".
      if (!result.ok) {
        const pendingCode =
          (isAccessPendingErrorCode(result.errorCode) ? result.errorCode : null) ??
          inferAccessPendingErrorCode(result.error);

        if (pendingCode) {
          const pending: PendingAccess = {
            message:
              (result.error && result.error.trim()) ||
              'Your account was created and is waiting for an administrator to grant access.',
            code: pendingCode,
          };
          writePendingForCode(code, pending);
          if (redirectCliCallbackError(pending.message, pending.code)) return;
          setPendingAccess(pending);
          setIsWorking(false);
          if (!cancelled) {
            navigate(buildLoginPendingUrl(nextPath, pending), { replace: true });
          }
          return;
        }

        // Code was likely consumed by a cancelled first attempt that already marked pending.
        const recovered = readPendingForCode(code);
        if (recovered && looksLikeUsedOAuthCode(result.error)) {
          if (redirectCliCallbackError(recovered.message, recovered.code)) return;
          setPendingAccess(recovered);
          setIsWorking(false);
          if (!cancelled) {
            navigate(buildLoginPendingUrl(nextPath, recovered), { replace: true });
          }
          return;
        }

        const message = result.error ?? 'Unable to complete OAuth login.';
        if (redirectCliCallbackError(message, result.errorCode)) return;
        setLocalError(message);
        setIsWorking(false);
        return;
      }

      clearPendingForCode(code);
      // Session is set in AuthProvider; the authenticated effect handles CLI bounce / next.
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    completeOAuthCallback,
    fragmentHasTokens,
    isAuthenticated,
    isLoading,
    location.pathname,
    location.search,
    navigate,
    nextPath,
  ]);

  const backToLogin = () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) clearPendingForCode(code);
    navigate(buildAuthUrlWithNext(urls.login, nextPath), { replace: true });
  };

  if (pendingAccess) {
    return (
      <AccessPendingView
        message={pendingAccess.message}
        code={pendingAccess.code}
        onBackToLogin={backToLogin}
      />
    );
  }

  if (localError && !isWorking) {
    return (
      <main className="flex min-h-full items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-xl animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
          <section
            className="border border-border bg-card"
            aria-labelledby="oauth-error-title"
          >
            <header className="border-b border-border px-8 py-6">
              <span className="inline-flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-destructive">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-destructive"
                  aria-hidden
                />
                Sign-in error
              </span>
              <h1
                id="oauth-error-title"
                className="mt-5 text-2xl font-semibold tracking-tight text-foreground"
              >
                We could not complete sign-in
              </h1>
            </header>
            <div className="space-y-4 px-8 py-6">
              <p className="text-[15px] leading-relaxed text-foreground/90">
                Something went wrong while connecting to your identity provider. This is a technical
                issue, not an account approval status.
              </p>
              <p className="border border-border bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {localError}
              </p>
            </div>
            <footer className="flex justify-end border-t border-border px-8 py-5">
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={backToLogin}
              >
                Back to login
              </button>
            </footer>
          </section>
        </div>
      </main>
    );
  }

  if (isWorking) {
    return (
      <main className="flex min-h-full items-center justify-center px-6 py-10">
        <p className="text-sm text-muted-foreground">Completing sign-in...</p>
      </main>
    );
  }

  return null;
};
