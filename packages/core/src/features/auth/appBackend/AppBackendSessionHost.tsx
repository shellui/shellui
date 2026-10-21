import { useEffect, useMemo, useRef } from 'react';
import { useConfig } from '../../config/useConfig';
import { useAuth } from '../hooks/useAuth';
import {
  endAppBackendSessions,
  ensureConfiguredAppBackends,
  resetAppBackendSilentAttempts,
} from './appBackendSessions';
import { listDistinctAppBackends } from './identity';
import { isSilentAuthCallbackFrame } from './silentSignIn';

/**
 * While the shell has a session, sign in to each embedded app's identity server.
 * The shell session itself is unchanged.
 */
export function AppBackendSessionHost() {
  const { config } = useConfig();
  const { session, isLoading } = useAuth();
  const signedInUserRef = useRef<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const identityKey = useMemo(
    () =>
      listDistinctAppBackends(config)
        .map((identity) => `${identity.key}|${identity.provider ?? ''}`)
        .join('\n'),
    [config],
  );

  const signedIn = Boolean(session?.accessToken);
  const userId = session?.userId ?? null;

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) return;
    if (isSilentAuthCallbackFrame()) return;
    if (isLoading) return;
    if (!signedIn) {
      void endAppBackendSessions();
      signedInUserRef.current = null;
      return;
    }
    if (signedInUserRef.current !== userId) {
      signedInUserRef.current = userId;
      resetAppBackendSilentAttempts();
    }
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await ensureConfiguredAppBackends(configRef.current, { allowSilent: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [identityKey, isLoading, signedIn, userId]);

  return null;
}
