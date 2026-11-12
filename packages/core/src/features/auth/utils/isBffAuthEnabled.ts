import { useConfig } from '../../config/useConfig';

/**
 * `security.bffAuth.enabled === true`.
 * The page does not treat this as proof the routes exist. See `resolveBffAuthRoutes`.
 */
export const isBffAuthEnabledFromConfig = (
  security: { bffAuth?: { enabled?: boolean } } | undefined,
): boolean => security?.bffAuth?.enabled === true;

/** `security.bffAuth.enabled === false` turns the host routes and the page probe off. */
export const isBffAuthExplicitlyDisabled = (
  security: { bffAuth?: { enabled?: boolean } } | undefined,
): boolean => security?.bffAuth?.enabled === false;

/** React hook. Reads the explicit `security.bffAuth.enabled` flag, not the probe. */
export const useIsBffAuthEnabled = (): boolean => {
  const { config } = useConfig();
  return isBffAuthEnabledFromConfig(config.security);
};
