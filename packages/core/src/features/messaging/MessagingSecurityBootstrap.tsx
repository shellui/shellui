import { shellui } from '@shellui/sdk';
import { useConfig } from '../config/useConfig';
import { deriveAllowedMessageOrigins } from './deriveAllowedMessageOrigins';

/**
 * Applies config-derived companion origins to the SDK message security policy.
 *
 * Must run during render (not a late `useEffect`) so localhost companions are
 * allowlisted before ContentView iframes can send privileged postMessages.
 */
export function MessagingSecurityBootstrap() {
  const { config } = useConfig();

  shellui.configureMessageSecurity({
    allowedOrigins: deriveAllowedMessageOrigins(config),
  });

  return null;
}
