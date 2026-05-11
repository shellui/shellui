import type { Settings, SettingsNavigationItem } from '@shellui/sdk';
import type { ShellUIConfig } from '../../config/types';
import { flattenNavigationItems } from './flattenNavigationItems';
import { getAvailableThemesForSettings } from './getAvailableThemesForSettings';
import { getResolvedAppearanceForSettings } from './getResolvedAppearanceForSettings';
import { resolveLabel } from './resolveLabel';

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
  },
): Settings => {
  const appearance = getResolvedAppearanceForSettings(settings, config);
  let result: Settings = {
    ...settings,
    appearance: appearance ?? settings.appearance,
  };

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
      }),
    );
    result = { ...result, navigation: { items } };
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
