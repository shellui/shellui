import { useEffect } from 'react';
import { shellui } from '@shellui/sdk';
import { useConfig } from '../config/useConfig';
import { deriveAllowedMessageOrigins } from './deriveAllowedMessageOrigins';

/**
 * Applies config-derived companion origins to the SDK message security policy.
 */
export function MessagingSecurityBootstrap() {
  const { config } = useConfig();

  useEffect(() => {
    shellui.configureMessageSecurity({
      allowedOrigins: deriveAllowedMessageOrigins(config),
    });
  }, [config]);

  return null;
}
