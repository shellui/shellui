import type { Settings } from '@shellui/sdk';
import type {
  EmailConfig,
  HostingConfig,
  NavigationItem,
  ShellUIConfig,
  StorageConfig,
} from '../../config/types';
import { isShellSettingsFrameSrc, isTrustedFrameForAuthToken } from '../../security/trustedFrames';
import urls from '../../../constants/urls';
import type { AuthSession } from '../types';
import {
  resolveFrameAppBackend,
  resolveFrameNavigationItem,
  type ResolvedAppBackend,
} from './identity';

/** Present keys replace the shell service. `null` sends no URL for that service. */
export type FrameServiceOverrides = {
  storage?: StorageConfig | null;
  email?: EmailConfig | null;
  hosting?: HostingConfig | null;
};

export type FrameAuthDelivery = {
  includeAuthAccessToken: boolean;
  /** Never the shell token when the frame's backend differs. */
  accessToken: string | null;
  overrideAuthBackend: boolean;
  authBackendBaseUrl: string | null;
  overrideUser: boolean;
  settingsUser: Settings['user'];
  services: FrameServiceOverrides;
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
    services: {},
  };
}

function foreignDelivery(
  frameSrc: string,
  config: ShellUIConfig | undefined,
  identity: ResolvedAppBackend | null,
  session: AuthSession | null,
  services: FrameServiceOverrides,
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
    services,
  };
}

/**
 * A service field on the item replaces the shell value.
 * When the item's identity server differs and the field is absent, send none.
 */
function serviceOverrides(item: NavigationItem | null, failClosed: boolean): FrameServiceOverrides {
  const overrides: FrameServiceOverrides = {};
  if (item?.storage !== undefined) overrides.storage = item.storage;
  else if (failClosed) overrides.storage = null;
  if (item?.email !== undefined) overrides.email = item.email;
  else if (failClosed) overrides.email = null;
  if (item?.hosting !== undefined) overrides.hosting = item.hosting;
  else if (failClosed) overrides.hosting = null;
  return overrides;
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
  const item = resolveFrameNavigationItem(frameSrc, config);
  const failClosed = resolved.kind !== 'shell';
  const services = serviceOverrides(item, failClosed);
  if (resolved.kind === 'shell') {
    return { ...shellDelivery(frameSrc, config, shellAccessToken), services };
  }
  if (resolved.kind === 'withhold') {
    return foreignDelivery(frameSrc, config, null, null, services);
  }
  return foreignDelivery(
    frameSrc,
    config,
    resolved.identity,
    getAppSession(resolved.identity.key),
    services,
  );
}

export type FrameAuthPropagationOptions = {
  includeAuthAccessToken: boolean;
  accessToken: string | null;
  authBackendBaseUrl?: string | null;
  settingsUser?: Settings['user'];
  storage?: StorageConfig | null;
  email?: EmailConfig | null;
  hosting?: HostingConfig | null;
};

function toPropagationOptions(delivery: FrameAuthDelivery): FrameAuthPropagationOptions {
  return {
    includeAuthAccessToken: delivery.includeAuthAccessToken,
    accessToken: delivery.accessToken,
    ...(delivery.overrideAuthBackend ? { authBackendBaseUrl: delivery.authBackendBaseUrl } : {}),
    ...(delivery.overrideUser ? { settingsUser: delivery.settingsUser } : {}),
    ...delivery.services,
  };
}

/** Options for `buildSettingsForPropagation`. Shell frames omit the override keys. */
export function frameAuthPropagationOptions(input: {
  frameSrc: string;
  config?: ShellUIConfig;
  shellAccessToken: string | null;
  getAppSession: (key: string) => AuthSession | null;
  shellOrigin?: string | null;
}): FrameAuthPropagationOptions {
  return toPropagationOptions(resolveFrameAuthDelivery(input));
}

/**
 * Auth fields for a child app hosted inside an embedded app (`createAppFrame`).
 * The shell token is never sent. With no allowed identity server the child gets
 * no token and no user. Service URLs are the ones the host passed and the shell
 * allowed (`childFrames.serviceOrigins`); any other service is `null`.
 */
export function childFrameAuthPropagationOptions(input: {
  identity: ResolvedAppBackend | null;
  getAppSession: (key: string) => AuthSession | null;
  services?: Partial<Record<'email' | 'storage' | 'hosting', string | null>> | null;
}): FrameAuthPropagationOptions {
  const { identity, getAppSession } = input;
  const allowed = input.services ?? {};
  const session = identity ? getAppSession(identity.key) : null;
  return toPropagationOptions({
    includeAuthAccessToken: Boolean(identity),
    accessToken: session?.accessToken ?? null,
    overrideAuthBackend: true,
    authBackendBaseUrl: identity?.type === 'shellui' ? identity.url : null,
    overrideUser: true,
    settingsUser: settingsUserFromSession(session),
    services: {
      email: allowed.email ? { url: allowed.email } : null,
      storage: allowed.storage ? { url: allowed.storage } : null,
      hosting: allowed.hosting ? { url: allowed.hosting } : null,
    },
  });
}
