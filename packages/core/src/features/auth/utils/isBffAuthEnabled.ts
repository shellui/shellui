import { useConfig } from '../../config/useConfig';

/** Whether same-origin BFF auth routes should handle refresh (HttpOnly cookie). */
export const isBffAuthEnabledFromConfig = (
  security: { bffAuth?: { enabled?: boolean } } | undefined,
): boolean => security?.bffAuth?.enabled === true;

/** React hook — reads `security.bffAuth.enabled` from shell config. */
export const useIsBffAuthEnabled = (): boolean => {
  const { config } = useConfig();
  return isBffAuthEnabledFromConfig(config.security);
};
