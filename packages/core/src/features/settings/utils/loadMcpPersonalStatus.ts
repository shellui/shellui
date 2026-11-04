import {
  fetchMcpPersonalStatus,
  getMcpPersonalCompanyId,
  getShellIdentityBackendUrl,
  type McpPersonalStatus,
} from '../../mcp/personalAgentsApi';
import type { ShellUIConfig } from '../../config/types';
import { getNormalizedAiServiceUrl } from './buildSettingsForPropagation';
import {
  readMcpPersonalStatusCache,
  writeMcpPersonalStatusCache,
  type McpPersonalStatusCacheScope,
} from './mcpPersonalStatusCache';

export type LoadMcpPersonalStatusInput = {
  config: ShellUIConfig | undefined;
  accessToken: string | null;
  isAuthenticated: boolean;
  userId: string | null;
};

const buildScope = (input: LoadMcpPersonalStatusInput): McpPersonalStatusCacheScope | null => {
  const backendUrl = getShellIdentityBackendUrl(input.config);
  if (
    !getNormalizedAiServiceUrl(input.config?.aiService) ||
    !input.isAuthenticated ||
    !backendUrl ||
    !input.accessToken ||
    !input.userId
  ) {
    return null;
  }
  return {
    userId: input.userId,
    backendUrl,
    companyId: getMcpPersonalCompanyId(input.config),
  };
};

let inFlightKey: string | null = null;
let inFlight: Promise<McpPersonalStatus | null> | null = null;

const scopeKey = (scope: McpPersonalStatusCacheScope): string =>
  `${scope.userId}\0${scope.backendUrl}\0${scope.companyId}`;

export const loadMcpPersonalStatus = (
  input: LoadMcpPersonalStatusInput,
): Promise<McpPersonalStatus | null> => {
  const scope = buildScope(input);
  if (!scope || !input.accessToken) {
    inFlightKey = null;
    inFlight = null;
    return Promise.resolve(null);
  }

  const key = scopeKey(scope);
  if (inFlight && inFlightKey === key) {
    return inFlight;
  }

  inFlightKey = key;
  inFlight = fetchMcpPersonalStatus(scope.backendUrl, input.accessToken, scope.companyId)
    .then((status) => {
      writeMcpPersonalStatusCache(scope, status);
      return status;
    })
    .catch(() => null)
    .finally(() => {
      if (inFlightKey === key) {
        inFlightKey = null;
        inFlight = null;
      }
    });

  return inFlight;
};

export const getCachedMcpPersonalStatus = (
  input: LoadMcpPersonalStatusInput,
): McpPersonalStatus | null => {
  const scope = buildScope(input);
  if (!scope) return null;
  return readMcpPersonalStatusCache(scope);
};
