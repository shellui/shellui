import type { ShellUIConfig } from '../../config/types';
import { isStorageSettingsEnabled } from '../../storage/quota';

/**
 * Settings → Storage nav is shown when remote storage is available to the user,
 * or when on-device AI is enabled (local model disk usage).
 */
export function shouldShowStorageSettings(options: {
  config: ShellUIConfig | undefined;
  isAuthenticated: boolean;
  aiEnabled: boolean;
}): boolean {
  const remoteVisible = isStorageSettingsEnabled(options.config) && options.isAuthenticated;
  return remoteVisible || options.aiEnabled;
}
