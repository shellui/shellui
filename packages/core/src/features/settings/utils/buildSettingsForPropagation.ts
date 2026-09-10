import type { Settings, SettingsNavigationItem } from '@shellui/sdk';
import type { ShellUIConfig } from '../../config/types';
import { flattenNavigationItems } from './flattenNavigationItems';
import { getAvailableThemesForSettings } from './getAvailableThemesForSettings';
import { getResolvedAppearanceForSettings } from './getResolvedAppearanceForSettings';
import { resolveLabel } from './resolveLabel';
import { getPublishedLayoutChrome } from '../../layouts/floating/layoutChromeStore';

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
    /** When false, omit layoutChrome (modal / drawer frames). Default true. */
    includeLayoutChrome?: boolean;
  },
): Settings => {
  const appearance = getResolvedAppearanceForSettings(settings, config);
  let result: Settings = {
    ...settings,
    appearance: appearance ?? settings.appearance,
  };

  if (options?.includeLayoutChrome !== false) {
    const layoutChrome = getPublishedLayoutChrome();
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

  const storageUrl = config?.storage?.url?.trim().replace(/\/+$/, '') || null;
  if (storageUrl) {
    const filesUrl = config.storage?.filesUrl?.trim() || null;
    result = {
      ...result,
      storage: {
        url: storageUrl,
        ...(filesUrl ? { filesUrl } : {}),
      },
    };
  } else {
    result = { ...result, storage: null };
  }

  const hostingUrl = config?.hosting?.url?.trim().replace(/\/+$/, '') || null;
  if (hostingUrl) {
    const app = config.hosting?.app?.trim() || null;
    result = {
      ...result,
      hosting: {
        url: hostingUrl,
        ...(app ? { app } : {}),
        ...(config.hosting?.showInAdmin === false ? { showInAdmin: false } : {}),
      },
    };
  } else {
    result = { ...result, hosting: null };
  }

  const authBackendBaseUrl =
    config?.backend?.type === 'shellui' && config.backend.url?.trim()
      ? config.backend.url.trim().replace(/\/+$/, '')
      : null;

  result = {
    ...result,
    accessToken: options?.includeAuthAccessToken ? (options.accessToken ?? null) : null,
    authBackendBaseUrl,
  };

  return result;
};
