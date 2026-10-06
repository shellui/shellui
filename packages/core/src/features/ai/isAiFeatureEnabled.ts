import type { ShellUIConfig } from '../config/types.js';

/**
 * Deploy-time AI product gate from `shellui.config` (`ai.enabled`).
 * Opt-in: only `true` enables AI; omitted means off. Distinct from Settings → AI `settings.ai.enabled`.
 */
export function isAiFeatureEnabled(config: ShellUIConfig | undefined | null): boolean {
  return config?.ai?.enabled === true;
}
