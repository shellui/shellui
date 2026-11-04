import { isAiFeatureEnabled } from '../../ai/isAiFeatureEnabled';
import { getShellIdentityBackendUrl } from '../../mcp/personalAgentsApi';
import type { ShellUIConfig } from '../../config/types';

/**
 * Settings → MCP / AI agents nav is shown when config AI is on, the user is signed in,
 * the shell uses a Shellui identity backend, and identity reports MCP enabled.
 */
export function shouldShowMcpAgentsSettings(options: {
  config: ShellUIConfig | undefined;
  isAuthenticated: boolean;
  /** `null` while status is loading or prerequisites are missing. */
  mcpEnabled: boolean | null;
}): boolean {
  if (!isAiFeatureEnabled(options.config)) return false;
  if (!options.isAuthenticated) return false;
  if (!getShellIdentityBackendUrl(options.config)) return false;
  return options.mcpEnabled === true;
}
