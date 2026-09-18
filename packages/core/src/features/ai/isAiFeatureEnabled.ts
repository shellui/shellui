import type { ShellUIConfig } from '../config/types.js';

/**
 * Deploy-time AI product gate from `shellui.config` (`ai.enabled`).
 * Default **true** when omitted. Distinct from Settings → AI `settings.ai.enabled`.
 */
export function isAiFeatureEnabled(config: ShellUIConfig | undefined | null): boolean {
  return config?.ai?.enabled !== false;
}
