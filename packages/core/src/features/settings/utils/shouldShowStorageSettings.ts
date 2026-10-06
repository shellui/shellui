import type { ShellUIConfig } from '../../config/types';
import { isStorageSettingsEnabled } from '../../storage/quota';

/**
 * Settings → Storage nav is shown when remote storage is available to the user,
 * or when on-device AI is enabled at both config and Settings layers (local model disk).
 *
 * Pass `aiEnabled` only when `config.ai.enabled === true` AND `settings.ai.enabled !== false`.
 * A shell without config AI must not keep Storage visible for AI alone.
 */
export function shouldShowStorageSettings(options: {
  config: ShellUIConfig | undefined;
  isAuthenticated: boolean;
  /** Combined config + settings AI gate for local model disk usage. */
  aiEnabled: boolean;
}): boolean {
  const remoteVisible = isStorageSettingsEnabled(options.config) && options.isAuthenticated;
  return remoteVisible || options.aiEnabled;
}
