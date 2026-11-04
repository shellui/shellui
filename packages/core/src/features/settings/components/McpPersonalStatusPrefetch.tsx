import { useEffect } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { useConfig } from '../../config/useConfig';
import { loadMcpPersonalStatus } from '../utils/loadMcpPersonalStatus';

/** Prefetch identity MCP status once after sign-in so Settings nav can render from cache. */
export const McpPersonalStatusPrefetch = () => {
  const { config } = useConfig();
  const { session, isAuthenticated, user } = useAuth();

  useEffect(() => {
    void loadMcpPersonalStatus({
      config,
      accessToken: session?.accessToken ?? null,
      isAuthenticated,
      userId: user?.id ?? null,
    });
  }, [config, session?.accessToken, isAuthenticated, user?.id]);

  return null;
};
