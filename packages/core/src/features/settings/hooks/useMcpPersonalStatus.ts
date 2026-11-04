import { useCallback, useEffect, useMemo, useState } from 'react';
import type { McpPersonalStatus } from '../../mcp/personalAgentsApi';
import type { ShellUIConfig } from '../../config/types';
import { getCachedMcpPersonalStatus, loadMcpPersonalStatus } from '../utils/loadMcpPersonalStatus';
import { isMcpAgentsSettingsEligible } from '../utils/isMcpAgentsSettingsEligible';

export type McpPersonalStatusState = {
  status: McpPersonalStatus | null;
  mcpEnabled: boolean | null;
  loading: boolean;
  navPending: boolean;
  error: boolean;
  refresh: () => void;
};

export function useMcpPersonalStatus(
  config: ShellUIConfig | undefined,
  accessToken: string | null,
  isAuthenticated: boolean,
  userId: string | null,
): McpPersonalStatusState {
  const eligible = isMcpAgentsSettingsEligible({ config, isAuthenticated });

  const cacheInput = useMemo(
    () => ({ config, accessToken, isAuthenticated, userId }),
    [config, accessToken, isAuthenticated, userId],
  );

  const cachedStatus = useMemo(
    () => (eligible ? getCachedMcpPersonalStatus(cacheInput) : null),
    [eligible, cacheInput],
  );

  const [status, setStatus] = useState<McpPersonalStatus | null>(() => cachedStatus);
  const [loading, setLoading] = useState(() => eligible && cachedStatus === null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!eligible) {
      setStatus(null);
      setLoading(false);
      setError(false);
      return;
    }

    const fromCache = getCachedMcpPersonalStatus(cacheInput);
    if (fromCache) {
      setStatus(fromCache);
    } else {
      setStatus(null);
      setLoading(true);
    }
    setError(false);

    let cancelled = false;
    void loadMcpPersonalStatus(cacheInput)
      .then((next) => {
        if (cancelled) return;
        if (next) {
          setStatus(next);
          setError(false);
        } else if (!fromCache) {
          setStatus(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eligible, cacheInput, tick]);

  const mcpEnabled = status ? status.mcpEnabled : loading ? null : false;
  const navPending = eligible && mcpEnabled === null;

  return { status, mcpEnabled, loading, navPending, error, refresh };
}
