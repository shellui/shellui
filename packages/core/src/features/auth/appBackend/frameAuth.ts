import type { Settings } from '@shellui/sdk';
import type { ShellUIConfig } from '../../config/types';
import { isShellSettingsFrameSrc, isTrustedFrameForAuthToken } from '../../security/trustedFrames';
import urls from '../../../constants/urls';
import type { AuthSession } from '../types';
import { resolveFrameAppBackend, type ResolvedAppBackend } from './identity';

export type FrameAuthDelivery = {
  includeAuthAccessToken: boolean;
  /** Never the shell token when the frame's backend differs. */
  accessToken: string | null;
  overrideAuthBackend: boolean;
  authBackendBaseUrl: string | null;
  overrideUser: boolean;
  settingsUser: Settings['user'];
};

const settingsUserFromSession = (session: AuthSession | null): Settings['user'] => {
  if (!session) return null;
  return {
    id: session.userId,
    email: session.userEmail,
    name: session.userName,
    profilePicture: session.userAvatarUrl,
    authProvider: session.provider,
    groups: session.userGroups?.length ? [...session.userGroups] : null,
    isStaff: session.userIsStaff,
    isCompanyOwner: session.userIsCompanyOwner,
  };
};

function currentShellOrigin(explicit?: string | null): string | null {
  if (explicit) return explicit;
  const origin = globalThis.window?.location?.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : null;
}

function shellDelivery(
  frameSrc: string,
  config: ShellUIConfig | undefined,
  shellAccessToken: string | null,
): FrameAuthDelivery {
  return {
    includeAuthAccessToken: isTrustedFrameForAuthToken(frameSrc, config),
    accessToken: shellAccessToken,
    overrideAuthBackend: false,
    authBackendBaseUrl: null,
    overrideUser: false,
    settingsUser: null,
  };
}

function foreignDelivery(
  frameSrc: string,
  config: ShellUIConfig | undefined,
  identity: ResolvedAppBackend | null,
  session: AuthSession | null,
): FrameAuthDelivery {
  const trusted = isTrustedFrameForAuthToken(frameSrc, config);
  const foreignToken = session?.accessToken ?? null;
  return {
    includeAuthAccessToken: trusted,
    accessToken: trusted ? foreignToken : null,
    overrideAuthBackend: true,
    authBackendBaseUrl: identity?.type === 'shellui' ? identity.url : null,
    overrideUser: true,
    settingsUser: settingsUserFromSession(session),
  };
}

/**
 * Per-frame auth fields for `SHELLUI_SETTINGS`.
 * No app `backend` (or the same server as the shell) keeps today's token and URL.
 */
export function resolveFrameAuthDelivery(input: {
  frameSrc: string;
  config?: ShellUIConfig;
  shellAccessToken: string | null;
  getAppSession: (key: string) => AuthSession | null;
  shellOrigin?: string | null;
}): FrameAuthDelivery {
  const { frameSrc, config, shellAccessToken, getAppSession } = input;
  const shellOrigin = currentShellOrigin(input.shellOrigin);
  if (shellOrigin && isShellSettingsFrameSrc(frameSrc, shellOrigin, urls.settings)) {
    return shellDelivery(frameSrc, config, shellAccessToken);
  }

  const resolved = resolveFrameAppBackend(frameSrc, config);
  if (resolved.kind === 'shell') {
    return shellDelivery(frameSrc, config, shellAccessToken);
  }
  if (resolved.kind === 'withhold') {
    return foreignDelivery(frameSrc, config, null, null);
  }
  return foreignDelivery(frameSrc, config, resolved.identity, getAppSession(resolved.identity.key));
}

/** Options for `buildSettingsForPropagation`. Shell frames omit the override keys. */
export function frameAuthPropagationOptions(input: {
  frameSrc: string;
  config?: ShellUIConfig;
  shellAccessToken: string | null;
  getAppSession: (key: string) => AuthSession | null;
  shellOrigin?: string | null;
}): {
  includeAuthAccessToken: boolean;
  accessToken: string | null;
  authBackendBaseUrl?: string | null;
  settingsUser?: Settings['user'];
} {
  const delivery = resolveFrameAuthDelivery(input);
  return {
    includeAuthAccessToken: delivery.includeAuthAccessToken,
    accessToken: delivery.accessToken,
    ...(delivery.overrideAuthBackend ? { authBackendBaseUrl: delivery.authBackendBaseUrl } : {}),
    ...(delivery.overrideUser ? { settingsUser: delivery.settingsUser } : {}),
  };
}
