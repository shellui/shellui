import type { ShellUIConfig } from '../../config/types';
import { isMcpAgentsSettingsEligible } from './isMcpAgentsSettingsEligible';

/**
 * Settings → MCP / AI agents nav is shown when an AI service URL is configured, the user
 * is signed in, the shell uses a Shellui identity backend, and identity reports MCP enabled.
 */
export function shouldShowMcpAgentsSettings(options: {
  config: ShellUIConfig | undefined;
  isAuthenticated: boolean;
  /** `null` while status is loading or prerequisites are missing. */
  mcpEnabled: boolean | null;
}): boolean {
  if (!isMcpAgentsSettingsEligible(options)) return false;
  return options.mcpEnabled === true;
}
