import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  getLogger,
  shellui,
  type ShellUIMessage,
  type Settings,
  type Appearance,
} from '@shellui/sdk';
import { SettingsContext } from './SettingsContext';
import { useConfig } from '../config/useConfig';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/hooks/useAuth';
import {
  buildSettingsForPropagation,
  getBrowserTimezone,
  getPreferenceSnapshot,
  isSameUser,
  mergePreferencesIntoSettings,
  toSettingsUser,
  type AppPreferences,
} from './utils';

const logger = getLogger('shellcore');
const USER_METADATA_ENDPOINT = '/auth/v1/user';
const APP_PREFERENCES_METADATA_KEY = 'shelluiPreferences';

const STORAGE_KEY = 'shellui:settings';

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
  user: null,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const { user: authUser, session, syncUserPreferences } = useAuth();
  const lastSyncedPreferencesRef = useRef<string | null>(null);
  const loadingPreferencesRef = useRef(false);
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
              name:
                parsed.appearance?.name ?? parsed.appearance?.themeName ?? defaultAppearance.name,
              colorScheme:
                parsed.appearance?.colorScheme ??
                parsed.appearance?.theme ??
                defaultAppearance.colorScheme,
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
            user: parsed.user ?? null,
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

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.parent !== window ||
      config?.backend?.type !== 'supabase' ||
      !config?.backend?.url ||
      !config?.backend?.publishableKey ||
      !session?.accessToken
    ) {
      return;
    }

    let cancelled = false;
    loadingPreferencesRef.current = true;
    const backendUrl = config.backend.url.replace(/\/+$/, '');
    const publishableKey = config.backend.publishableKey;

    const loadPreferencesFromSupabase = async () => {
      try {
        const userUrl = new URL(`${backendUrl}${USER_METADATA_ENDPOINT}`);
        userUrl.searchParams.set('apikey', publishableKey);

        const response = await fetch(userUrl.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            apikey: publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as {
          user_metadata?: Record<string, unknown>;
        };
        const preferences = payload.user_metadata?.[APP_PREFERENCES_METADATA_KEY] as
          | AppPreferences
          | undefined;

        if (cancelled) return;

        if (!preferences || typeof preferences !== 'object') {
          const currentSettings = settingsRef.current ?? defaultSettings;
          const fallbackSettings = mergePreferencesIntoSettings(currentSettings, {
            themeName: defaultAppearance.name,
            language: defaultSettings.language.code,
            region: getBrowserTimezone(),
            colorScheme: defaultAppearance.colorScheme,
          });
          const signature = JSON.stringify(getPreferenceSnapshot(fallbackSettings));
          lastSyncedPreferencesRef.current = signature;
          settingsRef.current = fallbackSettings;
          setSettings(fallbackSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackSettings));

          const settingsToPropagate = buildSettingsForPropagation(
            fallbackSettings,
            config,
            i18n.language || 'en',
          );
          shellui.propagateMessage({
            type: 'SHELLUI_SETTINGS',
            payload: { settings: settingsToPropagate },
          });

          logger.info('No Supabase preferences found; using app defaults');
          return;
        }

        const currentSettings = settingsRef.current ?? defaultSettings;
        const mergedSettings = mergePreferencesIntoSettings(currentSettings, preferences);
        const signature = JSON.stringify(getPreferenceSnapshot(mergedSettings));
        lastSyncedPreferencesRef.current = signature;
        settingsRef.current = mergedSettings;
        setSettings(mergedSettings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));

        const settingsToPropagate = buildSettingsForPropagation(
          mergedSettings,
          config,
          i18n.language || 'en',
        );
        shellui.propagateMessage({
          type: 'SHELLUI_SETTINGS',
          payload: { settings: settingsToPropagate },
        });

        logger.info('Loaded app preferences from Supabase metadata', {
          preferences: getPreferenceSnapshot(mergedSettings),
        });
      } catch (error) {
        logger.error('Failed to load app preferences from Supabase metadata', { error });
      } finally {
        loadingPreferencesRef.current = false;
      }
    };

    void loadPreferencesFromSupabase();
    return () => {
      cancelled = true;
      loadingPreferencesRef.current = false;
    };
  }, [
    config?.backend?.publishableKey,
    config?.backend?.type,
    config?.backend?.url,
    i18n.language,
    session?.accessToken,
    session?.userId,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const currentSettings = settingsRef.current ?? defaultSettings;
    const nextUser = toSettingsUser(authUser);
    if (isSameUser(currentSettings.user, nextUser)) {
      return;
    }

    const nextSettings = { ...currentSettings, user: nextUser };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
      const settingsWithNav = buildSettingsForPropagation(
        nextSettings,
        config,
        i18n.language || 'en',
      );
      shellui.propagateMessage({
        type: 'SHELLUI_SETTINGS',
        payload: { settings: settingsWithNav },
      });
    } catch (error) {
      logger.error('Failed to sync auth user into settings:', { error });
    }
  }, [authUser, config, i18n.language]);

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

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window || loadingPreferencesRef.current) {
      return;
    }

    const preferences = getPreferenceSnapshot(settings);
    const signature = JSON.stringify(preferences);
    if (signature === lastSyncedPreferencesRef.current) {
      return;
    }

    let cancelled = false;

    const syncPreferences = async () => {
      try {
        await syncUserPreferences(preferences);
        if (cancelled) return;
        lastSyncedPreferencesRef.current = signature;
        logger.info('Synced app preferences to auth provider metadata', { preferences });
      } catch (error) {
        logger.error('Failed to sync app preferences to auth provider metadata', { error });
      }
    };

    void syncPreferences();
    return () => {
      cancelled = true;
    };
  }, [settings, syncUserPreferences]);

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
