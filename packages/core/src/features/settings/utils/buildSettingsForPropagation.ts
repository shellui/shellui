import type {
  Settings,
  SettingsEmail,
  SettingsHosting,
  SettingsNavigationItem,
  SettingsStorage,
} from '@shellui/sdk';
import type { EmailConfig, HostingConfig, ShellUIConfig, StorageConfig } from '../../config/types';
import { flattenNavigationItems } from './flattenNavigationItems';
import { getAvailableThemesForSettings } from './getAvailableThemesForSettings';
import { getResolvedAppearanceForSettings } from './getResolvedAppearanceForSettings';
import { resolveLabel } from './resolveLabel';
import {
  getLayoutChromeForFrame,
  getPublishedLayoutChrome,
} from '../../layouts/floating/layoutChromeStore';

const propagateEmail = (email: EmailConfig | null | undefined): SettingsEmail | null => {
  // No built-in default: email must come from config or the host app.
  const url = email?.url?.trim().replace(/\/+$/, '') || null;
  if (!url) return null;
  return {
    url,
    ...(email?.showInAdmin === false ? { showInAdmin: false } : {}),
  };
};

const propagateStorage = (storage: StorageConfig | null | undefined): SettingsStorage | null => {
  const storageUrl = storage?.url?.trim().replace(/\/+$/, '') || null;
  if (!storageUrl) return null;
  const filesUrl = storage?.filesUrl?.trim() || null;
  return {
    url: storageUrl,
    ...(filesUrl ? { filesUrl } : {}),
  };
};

const propagateHosting = (hosting: HostingConfig | null | undefined): SettingsHosting | null => {
  const hostingUrl = hosting?.url?.trim().replace(/\/+$/, '') || null;
  if (!hostingUrl) return null;
  const app = hosting?.app?.trim() || null;
  return {
    url: hostingUrl,
    ...(app ? { app } : {}),
    ...(hosting?.showInAdmin === false ? { showInAdmin: false } : {}),
  };
};

/**
 * Build settings for propagation to iframes: inject navigation, full theme object,
 * and list of available themes so apps can render theme pickers.
 */
export const buildSettingsForPropagation = (
  settings: Settings,
  config: ShellUIConfig | undefined,
  lang: string,
  options?: {
    includeAuthAccessToken?: boolean;
    accessToken?: string | null;
    /**
     * Identity base URL for this frame. When the key is set, it replaces the shell
     * `backend` URL (`null` when that server is not a Shellui identity backend).
     */
    authBackendBaseUrl?: string | null;
    /** User for this frame's identity server. When the key is set, it replaces `settings.user`. */
    settingsUser?: Settings['user'];
    /**
     * Storage for this frame. When the key is set, it replaces the shell `storage`
     * (`null` sends no storage URL).
     */
    storage?: StorageConfig | null;
    /** Email for this frame. When the key is set, it replaces the shell `email`. */
    email?: EmailConfig | null;
    /** Hosting for this frame. When the key is set, it replaces the shell `hosting`. */
    hosting?: HostingConfig | null;
    /** When false, omit layoutChrome (modal / drawer frames). Default true. */
    includeLayoutChrome?: boolean;
    /** Merge this frame's action-bar insets into layoutChrome. */
    frameUuid?: string;
  },
): Settings => {
  const appearance = getResolvedAppearanceForSettings(settings, config);
  let result: Settings = {
    ...settings,
    appearance: appearance ?? settings.appearance,
    ...(options && 'settingsUser' in options ? { user: options.settingsUser ?? null } : {}),
  };

  if (options?.includeLayoutChrome !== false) {
    const layoutChrome = options?.frameUuid
      ? getLayoutChromeForFrame(options.frameUuid)
      : getPublishedLayoutChrome();
    if (layoutChrome) {
      result = { ...result, layoutChrome };
    } else if ('layoutChrome' in result) {
      const { layoutChrome: _removed, ...rest } = result;
      result = rest;
    }
  } else if ('layoutChrome' in result) {
    const { layoutChrome: _removed, ...rest } = result;
    result = rest;
  }

  // Inject available themes when we have a resolved appearance (themes are already registered above)
  if (result.appearance && typeof window !== 'undefined') {
    result = {
      ...result,
      appearance: {
        ...result.appearance,
        availableThemes: getAvailableThemesForSettings(),
      },
    };
  }

  if (config?.navigation?.length) {
    const items: SettingsNavigationItem[] = flattenNavigationItems(config.navigation).map(
      (item) => ({
        path: item.path,
        url: item.url,
        label: resolveLabel(item.label, lang),
        ...(item.icon ? { icon: item.icon } : {}),
      }),
    );
    result = { ...result, navigation: { items } };
  }

  if (config?.administration) {
    result = {
      ...result,
      administration: {
        title: resolveLabel(config.administration.title, lang),
        navigation: (config.administration.navigation ?? []).map((item) => ({
          path: item.path,
          url: item.url,
          label: resolveLabel(item.label, lang),
          ...(item.icon ? { icon: item.icon } : {}),
          ...(item.requiresStaff ? { requiresStaff: true } : {}),
          ...(item.openIn === 'external' ? { openIn: 'external' as const } : {}),
        })),
      },
    };
  } else {
    result = { ...result, administration: null };
  }

  const storageSource = options && 'storage' in options ? options.storage : config?.storage;
  const hostingSource = options && 'hosting' in options ? options.hosting : config?.hosting;
  const emailSource = options && 'email' in options ? options.email : config?.email;

  result = {
    ...result,
    storage: propagateStorage(storageSource),
    hosting: propagateHosting(hostingSource),
    email: propagateEmail(emailSource),
  };

  const shellAuthBackendBaseUrl =
    config?.backend?.type === 'shellui' && config.backend.url?.trim()
      ? config.backend.url.trim().replace(/\/+$/, '')
      : null;
  const authBackendBaseUrl =
    options && 'authBackendBaseUrl' in options
      ? (options.authBackendBaseUrl ?? null)
      : shellAuthBackendBaseUrl;

  result = {
    ...result,
    accessToken: options?.includeAuthAccessToken ? (options.accessToken ?? null) : null,
    authBackendBaseUrl,
  };

  if ('refreshToken' in result) {
    const { refreshToken: _refreshRemoved, ...withoutRefresh } = result as Settings & {
      refreshToken?: string;
    };
    return withoutRefresh;
  }

  return result;
};
