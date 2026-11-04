import { useCallback, useEffect, useState } from 'react';
import { isAiFeatureEnabled } from '../../ai/isAiFeatureEnabled';
import {
  fetchMcpPersonalStatus,
  getMcpPersonalCompanyId,
  getShellIdentityBackendUrl,
  type McpPersonalStatus,
} from '../../mcp/personalAgentsApi';
import type { ShellUIConfig } from '../../config/types';

export type McpPersonalStatusState = {
  status: McpPersonalStatus | null;
  mcpEnabled: boolean | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
};

export function useMcpPersonalStatus(
  config: ShellUIConfig | undefined,
  accessToken: string | null,
  isAuthenticated: boolean,
): McpPersonalStatusState {
  const [status, setStatus] = useState<McpPersonalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const backendUrl = getShellIdentityBackendUrl(config);
    const aiOn = isAiFeatureEnabled(config);
    if (!aiOn || !isAuthenticated || !backendUrl || !accessToken) {
      setStatus(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchMcpPersonalStatus(backendUrl, accessToken, getMcpPersonalCompanyId(config))
      .then((next) => {
        if (!cancelled) {
          setStatus(next);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
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
  }, [config, accessToken, isAuthenticated, tick]);

  const mcpEnabled = loading ? null : error ? false : (status?.mcpEnabled ?? false);

  return { status, mcpEnabled, loading, error, refresh };
}
