import { getShellIdentityBackendUrl } from '../../mcp/personalAgentsApi';
import type { ShellUIConfig } from '../../config/types';
import { getNormalizedAiServiceUrl } from './buildSettingsForPropagation';

/** Prerequisites for Settings MCP / AI agents (identity MCP flag is loaded separately). */
export function isMcpAgentsSettingsEligible(options: {
  config: ShellUIConfig | undefined;
  isAuthenticated: boolean;
}): boolean {
  if (!getNormalizedAiServiceUrl(options.config?.aiService)) return false;
  if (!options.isAuthenticated) return false;
  if (!getShellIdentityBackendUrl(options.config)) return false;
  return true;
}
