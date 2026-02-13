import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  getLogger,
  shellui,
  type ShellUIMessage,
  type Settings,
  type SettingsNavigationItem,
  type Appearance,
  type SettingsAvailableTheme,
} from '@shellui/sdk';
import { SettingsContext } from './SettingsContext';
import { useConfig } from '../config/useConfig';
import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup, ShellUIConfig } from '../config/types';
import { getTheme, getAllThemes, registerTheme } from '../theme/themes';

const logger = getLogger('shellcore');

function flattenNavigationItems(
  navigation: (NavigationItem | NavigationGroup)[],
): NavigationItem[] {
  if (navigation.length === 0) return [];
  return navigation.flatMap((item) => {
    if ('title' in item && 'items' in item) return (item as NavigationGroup).items;
    return [item as NavigationItem];
  });
}

function resolveLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

function resolveColorMode(colorScheme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (colorScheme === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return colorScheme === 'dark' ? 'dark' : 'light';
}

/** Convert font file URLs to absolute so iframes/modals on other ports or domains can load them. */
function toAbsoluteFontUrls(urls: string[]): string[] {
  if (typeof window === 'undefined') return urls;
  const origin = window.location.origin;
  return urls.map((url) => {
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${origin}${path}`;
  });
}

/**
 * Build the full appearance object for settings propagation so apps receive all theme
 * variable values and can style without knowing the theme name.
 */
function getResolvedAppearanceForSettings(
  settings: Settings,
  config: ShellUIConfig | undefined,
): Appearance | undefined {
  if (typeof window === 'undefined') return undefined;
  config?.themes?.forEach(registerTheme);
  const themeName =
    settings.appearance?.name || config?.defaultTheme || 'default';
  const themeDef = getTheme(themeName) || getTheme('default');
  if (!themeDef) return undefined;
  const colorScheme = settings.appearance?.colorScheme ?? 'system';
  const mode = resolveColorMode(colorScheme);
  return {
    name: themeDef.name,
    displayName: themeDef.displayName,
    mode,
    colorScheme,
    colors: themeDef.colors,
    ...(themeDef.fontFamily !== undefined && { fontFamily: themeDef.fontFamily }),
    ...(themeDef.bodyFontFamily !== undefined && {
      bodyFontFamily: themeDef.bodyFontFamily,
    }),
    ...(themeDef.headingFontFamily !== undefined && {
      headingFontFamily: themeDef.headingFontFamily,
    }),
    ...(themeDef.letterSpacing !== undefined && {
      letterSpacing: themeDef.letterSpacing,
    }),
    ...(themeDef.textShadow !== undefined && { textShadow: themeDef.textShadow }),
    ...(themeDef.lineHeight !== undefined && { lineHeight: themeDef.lineHeight }),
    ...(themeDef.fontFiles !== undefined &&
      themeDef.fontFiles.length > 0 && {
        fontFiles: toAbsoluteFontUrls(themeDef.fontFiles),
      }),
  };
}

/**
 * Map registered themes to the slim shape sent to sub-apps (name, displayName, colors, optional typography for preview).
 */
function getAvailableThemesForSettings(): SettingsAvailableTheme[] {
  return getAllThemes().map((theme) => ({
    name: theme.name,
    displayName: theme.displayName,
    colors: theme.colors,
    ...(theme.fontFamily !== undefined && { fontFamily: theme.fontFamily }),
    ...(theme.letterSpacing !== undefined && { letterSpacing: theme.letterSpacing }),
    ...(theme.textShadow !== undefined && { textShadow: theme.textShadow }),
  }));
}

/**
 * Build settings for propagation to iframes: inject navigation, full theme object,
 * and list of available themes so apps can render theme pickers.
 */
function buildSettingsForPropagation(
  settings: Settings,
  config: ShellUIConfig | undefined,
  lang: string,
): Settings {
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
    const items: SettingsNavigationItem[] = flattenNavigationItems(
      config.navigation,
    ).map((item) => ({
      path: item.path,
      url: item.url,
      label: resolveLabel(item.label, lang),
    }));
    result = { ...result, navigation: { items } };
  }
  return result;
}

const STORAGE_KEY = 'shellui:settings';

// Get browser's timezone as default
const getBrowserTimezone = (): string => {
  if (typeof window !== 'undefined' && Intl) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
};

const defaultAppearance: Appearance = {
  name: 'default',
  displayName: 'Default',
  mode: 'light',
  colorScheme: 'system',
  colors: {
    light: {
      background: '#ffffff',
      foreground: '#09090b',
      card: '#ffffff',
      cardForeground: '#09090b',
      popover: '#ffffff',
      popoverForeground: '#09090b',
      primary: '#18181b',
      primaryForeground: '#fafafa',
      secondary: '#f4f4f5',
      secondaryForeground: '#18181b',
      muted: '#f4f4f5',
      mutedForeground: '#71717a',
      accent: '#f4f4f5',
      accentForeground: '#18181b',
      destructive: '#ef4444',
      destructiveForeground: '#fafafa',
      border: '#e4e4e7',
      input: '#e4e4e7',
      ring: '#18181b',
      radius: '0.5rem',
      sidebarBackground: '#fafafa',
      sidebarForeground: '#09090b',
      sidebarPrimary: '#18181b',
      sidebarPrimaryForeground: '#fafafa',
      sidebarAccent: '#e4e4e7',
      sidebarAccentForeground: '#18181b',
      sidebarBorder: '#e4e4e7',
      sidebarRing: '#18181b',
    },
    dark: {
      background: '#09090b',
      foreground: '#fafafa',
      card: '#09090b',
      cardForeground: '#fafafa',
      popover: '#09090b',
      popoverForeground: '#fafafa',
      primary: '#fafafa',
      primaryForeground: '#18181b',
      secondary: '#27272a',
      secondaryForeground: '#fafafa',
      muted: '#27272a',
      mutedForeground: '#a1a1aa',
      accent: '#27272a',
      accentForeground: '#fafafa',
      destructive: '#7f1d1d',
      destructiveForeground: '#fafafa',
      border: '#27272a',
      input: '#27272a',
      ring: '#d4d4d8',
      radius: '0.5rem',
      sidebarBackground: '#09090b',
      sidebarForeground: '#fafafa',
      sidebarPrimary: '#fafafa',
      sidebarPrimaryForeground: '#18181b',
      sidebarAccent: '#27272a',
      sidebarAccentForeground: '#fafafa',
      sidebarBorder: '#27272a',
      sidebarRing: '#d4d4d8',
    },
  },
};

const defaultSettings: Settings = {
  developerFeatures: {
    enabled: false,
  },
  errorReporting: {
    enabled: true,
  },
  logging: {
    namespaces: {
      shellsdk: false,
      shellcore: false,
    },
  },
  appearance: defaultAppearance,
  language: {
    code: 'en',
  },
  region: {
    timezone: getBrowserTimezone(),
  },
  cookieConsent: {
    acceptedHosts: [],
    consentedCookieHosts: [],
  },
  serviceWorker: {
    enabled: true,
  },
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const { i18n } = useTranslation();
  // Use a ref to always have current settings for message listeners (avoids closure issues)
  const settingsRef = useRef<Settings | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    let initialSettings: Settings;

    if (shellui.initialSettings) {
      initialSettings = shellui.initialSettings;
      settingsRef.current = initialSettings;
      return initialSettings;
    }

    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Deep merge with defaults to handle new settings
          initialSettings = {
            ...defaultSettings,
            ...parsed,
            errorReporting: {
              enabled: parsed.errorReporting?.enabled ?? defaultSettings.errorReporting.enabled,
            },
            logging: {
              namespaces: {
                ...defaultSettings.logging.namespaces,
                ...parsed.logging?.namespaces,
              },
            },
            appearance: {
              ...defaultAppearance,
              ...parsed.appearance,
              // Migrate from legacy theme/themeName
              name: parsed.appearance?.name ?? parsed.appearance?.themeName ?? defaultAppearance.name,
              colorScheme:
                parsed.appearance?.colorScheme ?? parsed.appearance?.theme ?? defaultAppearance.colorScheme,
              colors: parsed.appearance?.colors ?? defaultAppearance.colors,
            },
            language: {
              code: parsed.language?.code || defaultSettings.language.code,
            },
            region: {
              // Only use stored timezone if it exists, otherwise use browser's current timezone
              timezone: parsed.region?.timezone || getBrowserTimezone(),
            },
            cookieConsent: {
              acceptedHosts: Array.isArray(parsed.cookieConsent?.acceptedHosts)
                ? parsed.cookieConsent.acceptedHosts
                : (defaultSettings.cookieConsent?.acceptedHosts ?? []),
              consentedCookieHosts: Array.isArray(parsed.cookieConsent?.consentedCookieHosts)
                ? parsed.cookieConsent.consentedCookieHosts
                : (defaultSettings.cookieConsent?.consentedCookieHosts ?? []),
            },
            serviceWorker: {
              // Migrate from legacy "caching" key if present
              enabled: parsed.serviceWorker?.enabled ?? parsed.caching?.enabled ?? true,
            },
          };
          settingsRef.current = initialSettings;
          return initialSettings;
        }
      } catch (error) {
        logger.error('Failed to load settings from localStorage:', { error });
      }
    }
    settingsRef.current = defaultSettings;
    return defaultSettings;
  });

  // Keep ref in sync with state for message listeners
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Listen for settings updates from parent/other nodes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const cleanup = shellui.addMessageListener(
      'SHELLUI_SETTINGS_UPDATED',
      (message: ShellUIMessage) => {
        const payload = message.payload as { settings: Settings };
        const newSettings = payload.settings;
        if (newSettings) {
          // Update localStorage with new settings value
          setSettings(newSettings);
          if (window.parent === window) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
              // Confirm: root updated localStorage; re-inject navigation when propagating
              const settingsToPropagate = buildSettingsForPropagation(
                newSettings,
                config,
                i18n.language || 'en',
              );
              logger.info('Root Parent received settings update', { message });
              shellui.propagateMessage({
                type: 'SHELLUI_SETTINGS',
                payload: { settings: settingsToPropagate },
              });
            } catch (error) {
              logger.error('Failed to update settings from message:', { error });
            }
          }
        }
      },
    );

    const cleanupSettingsRequested = shellui.addMessageListener(
      'SHELLUI_SETTINGS_REQUESTED',
      () => {
        // Use ref to always get current settings (avoids stale closure)
        const currentSettings = settingsRef.current ?? defaultSettings;
        const settingsWithNav = buildSettingsForPropagation(
          currentSettings,
          config,
          i18n.language || 'en',
        );
        shellui.propagateMessage({
          type: 'SHELLUI_SETTINGS',
          payload: { settings: settingsWithNav },
        });
      },
    );

    const cleanupSettings = shellui.addMessageListener(
      'SHELLUI_SETTINGS',
      (data: ShellUIMessage) => {
        const message = data as ShellUIMessage;
        const payload = message.payload as { settings: Settings };
        const newSettings = payload.settings;
        if (newSettings) {
          setSettings(newSettings);
        }
      },
    );

    return () => {
      cleanup();
      cleanupSettings();
      cleanupSettingsRequested();
    };
  }, [settings, config?.navigation, i18n.language]);

  // ACTIONS
  const updateSettings = useCallback(
    (updates: Partial<Settings>) => {
      const newSettings = { ...settings, ...updates };

      // Update localStorage and propagate to children if we're in the root window
      if (typeof window !== 'undefined' && window.parent === window) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          setSettings(newSettings);
          // Propagate to child iframes (sendMessageToParent does nothing in root)
          const settingsWithNav = buildSettingsForPropagation(
            newSettings,
            config,
            i18n.language || 'en',
          );
          shellui.propagateMessage({
            type: 'SHELLUI_SETTINGS',
            payload: { settings: settingsWithNav },
          });
        } catch (error) {
          logger.error('Failed to update settings in localStorage:', { error });
        }
      }

      // For child iframes, send to parent (parent will propagate to siblings)
      shellui.sendMessageToParent({
        type: 'SHELLUI_SETTINGS_UPDATED',
        payload: { settings: newSettings },
      });
    },
    [settings, config?.navigation, i18n.language],
  );

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, updates: Partial<Settings[K]>) => {
      // Deep merge: preserve existing nested properties
      const currentValue = settings[key];
      const mergedValue =
        typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
          ? { ...currentValue, ...updates }
          : updates;
      updateSettings({ [key]: mergedValue } as Partial<Settings>);
    },
    [settings, updateSettings],
  );

  const resetAllData = useCallback(() => {
    // Clear all localStorage data
    if (typeof window !== 'undefined') {
      try {
        // Clear settings
        localStorage.removeItem(STORAGE_KEY);

        // Clear all other localStorage items that start with shellui:
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('shellui:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Reset settings to defaults
        const newSettings = defaultSettings;
        setSettings(newSettings);

        // If we're in the root window, update localStorage with defaults
        if (window.parent === window) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          const settingsToPropagate = buildSettingsForPropagation(
            newSettings,
            config,
            i18n.language || 'en',
          );
          shellui.propagateMessage({
            type: 'SHELLUI_SETTINGS',
            payload: { settings: settingsToPropagate },
          });
        }

        // Notify parent about reset
        shellui.sendMessageToParent({
          type: 'SHELLUI_SETTINGS_UPDATED',
          payload: { settings: newSettings },
        });

        logger.info('All app data has been reset');
      } catch (error) {
        logger.error('Failed to reset all data:', { error });
      }
    }
  }, [config?.navigation, i18n.language]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      updateSetting,
      resetAllData,
    }),
    [settings, updateSettings, updateSetting, resetAllData],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
