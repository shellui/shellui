import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import urls from '../../../constants/urls';
import { normalizeNextPath } from '../utils';
import { useAuth } from '../hooks/useAuth';

const toPositiveInt = (raw: string | null): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
};

export const OAuthCallbackView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthCallback, isAuthenticated } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(true);
  const hasStartedRef = useRef(false);
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNextPath(params.get('next')) ?? '/';
  }, [location.search]);

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(nextPath, { replace: true });
  }, [isAuthenticated, navigate, nextPath]);

  useEffect(() => {
    let cancelled = false;
    if (hasStartedRef.current || isAuthenticated) {
      return () => {
        cancelled = true;
      };
    }
    hasStartedRef.current = true;
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const oauthError = params.get('error');
      if (oauthError) {
        if (!cancelled) {
          setLocalError(oauthError);
          setIsWorking(false);
        }
        return;
      }
      const code = params.get('code');
      const provider = params.get('provider');
      if (!code || !provider) {
        if (!cancelled) {
          setLocalError('Missing OAuth callback parameters.');
          setIsWorking(false);
        }
        return;
      }
      const redirectUri = `${window.location.origin}${location.pathname}${location.search}`;
      const ok = await completeOAuthCallback({
        provider,
        code,
        redirectUri,
        oauthClientId: toPositiveInt(params.get('company_oauth_client_id')),
      });
      if (cancelled) return;
      if (!ok) {
        setIsWorking(false);
        return;
      }
      navigate(nextPath, { replace: true });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [completeOAuthCallback, isAuthenticated, location.pathname, location.search, navigate, nextPath]);

  const displayError = localError;
  if (displayError) {
    return (
      <main className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg space-y-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            OAuth sign-in failed
          </h1>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayError}
          </p>
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() =>
              navigate(`${urls.login}?next=${encodeURIComponent(nextPath)}`, { replace: true })
            }
          >
            Return to login
          </button>
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
