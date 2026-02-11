import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  getLogger,
  shellui,
  type ShellUIMessage,
  type Settings,
  type SettingsNavigationItem,
} from '@shellui/sdk';
import { SettingsContext } from './SettingsContext';
import { useConfig } from '../config/useConfig';
import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup } from '../config/types';

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

function buildSettingsWithNavigation(
  settings: Settings,
  navigation: (NavigationItem | NavigationGroup)[] | undefined,
  lang: string,
): Settings {
  if (!navigation?.length) return settings;
  const items: SettingsNavigationItem[] = flattenNavigationItems(navigation).map((item) => ({
    path: item.path,
    url: item.url,
    label: resolveLabel(item.label, lang),
  }));
  return { ...settings, navigation: { items } };
}

const STORAGE_KEY = 'shellui:settings';

// Get browser's timezone as default
const getBrowserTimezone = (): string => {
  if (typeof window !== 'undefined' && Intl) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
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
  appearance: {
    theme: 'system',
    themeName: 'default',
  },
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
              theme: parsed.appearance?.theme || defaultSettings.appearance.theme,
              themeName: parsed.appearance?.themeName || defaultSettings.appearance.themeName,
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
              const settingsToPropagate = buildSettingsWithNavigation(
                newSettings,
                config?.navigation,
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
        const settingsWithNav = buildSettingsWithNavigation(
          currentSettings,
          config?.navigation,
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
          const settingsWithNav = buildSettingsWithNavigation(
            newSettings,
            config?.navigation,
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
          const settingsToPropagate = buildSettingsWithNavigation(
            newSettings,
            config?.navigation,
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
