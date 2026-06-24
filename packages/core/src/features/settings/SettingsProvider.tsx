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
import type { NavigationItem } from '../config/types';
import { useAuth } from '../auth/hooks/useAuth';
import { isAdminFrame } from '../admin/utils';
import { defaultTheme } from '../theme/themes';
import {
  buildSettingsForPropagation,
  getBrowserTimezone,
  getPreferenceSnapshot,
  isSameUser,
  mergePreferencesIntoSettings,
  toSettingsUser,
} from './utils';
import { unregisterServiceWorker } from '../../service-worker/register';

const logger = getLogger('shellcore');

const STORAGE_KEY = 'shellui:settings';
const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';
const AUTH_LAST_USED_LOGIN_STORAGE_KEY = 'shellui.auth.last_used_login';

const toAbsoluteUrl = (url: string): URL | null => {
  try {
    return new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );
  } catch {
    return null;
  }
};

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
};

const normalizeHashPath = (value: string): string => {
  const hash = value.replace(/^#\/?/, '').replace(/\/+$/, '');
  return hash;
};

const isFrameForNavigationItem = (frameSrc: string, itemUrl: string): boolean => {
  const frame = toAbsoluteUrl(frameSrc);
  const item = toAbsoluteUrl(itemUrl);
  if (!frame || !item) return false;
  if (frame.origin !== item.origin) return false;

  const itemPathname = normalizePath(item.pathname);
  const framePathname = normalizePath(frame.pathname);
  if (framePathname !== itemPathname && !framePathname.startsWith(`${itemPathname}/`)) {
    return false;
  }

  const itemHashPath = normalizeHashPath(item.hash);
  if (!itemHashPath) {
    return true;
  }

  const frameHashPath = normalizeHashPath(frame.hash);
  return frameHashPath === itemHashPath || frameHashPath.startsWith(`${itemHashPath}/`);
};

const stripSensitiveUserFields = (settings: Settings): Settings => {
  return {
    ...settings,
    accessToken: null,
  };
};

const defaultAppearance: Appearance = {
  name: defaultTheme.name,
  displayName: defaultTheme.displayName,
  mode: 'light',
  colorScheme: 'system',
  colors: defaultTheme.colors,
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
    enabled: false,
  },
  user: null,
  accessToken: null,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const { user: authUser, session, syncUserPreferences, loadUserPreferences, logout } = useAuth();
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
              // Migrate from legacy "caching" key if present; default off for new installs
              enabled: parsed.serviceWorker?.enabled ?? parsed.caching?.enabled ?? false,
            },
            user: parsed.user ?? null,
            accessToken: null,
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

  const navigationItems = useMemo<NavigationItem[]>(
    () =>
      config?.navigation?.flatMap((item) =>
        'title' in item && 'items' in item ? item.items : [item],
      ) ?? [],
    [config?.navigation],
  );

  const isTrustedFrameForAuthToken = useCallback(
    (frameSrc: string): boolean => {
      if (isAdminFrame(frameSrc, config)) {
        return true;
      }
      return navigationItems.some(
        (item) => item.safeForAuthToken !== false && isFrameForNavigationItem(frameSrc, item.url),
      );
    },
    [config, navigationItems],
  );

  const propagateSettingsToIframes = useCallback(
    (baseSettings: Settings) => {
      const iframes = shellui.frameRegistry.getAllIframes();
      if (iframes.length === 0) return;
      const lang = baseSettings.language?.code || 'en';
      for (const [uuid, iframe] of iframes) {
        const frameSrc = iframe?.src ?? '';
        const includeAuthAccessToken = isTrustedFrameForAuthToken(frameSrc);
        const settingsToPropagate = buildSettingsForPropagation(baseSettings, config, lang, {
          includeAuthAccessToken,
          accessToken: session?.accessToken ?? null,
        });
        shellui.sendMessage({
          type: 'SHELLUI_SETTINGS',
          payload: { settings: settingsToPropagate },
          to: [uuid],
        });
      }
    },
    [config, isTrustedFrameForAuthToken, session?.accessToken],
  );

  // When the shell rotates the JWT, `authUser` often does not change, so the user-sync effect
  // above skips — still push `SHELLUI_SETTINGS` so trusted iframes get the new `accessToken`.
  const accessTokenForChildren = session?.accessToken ?? null;
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window || !accessTokenForChildren) {
      return;
    }
    propagateSettingsToIframes(settingsRef.current ?? defaultSettings);
  }, [accessTokenForChildren, propagateSettingsToIframes]);

  // Keep load/sync helpers stable across access-token rotation (refresh after preference sync).
  const loadUserPreferencesRef = useRef(loadUserPreferences);
  loadUserPreferencesRef.current = loadUserPreferences;
  const syncUserPreferencesRef = useRef(syncUserPreferences);
  syncUserPreferencesRef.current = syncUserPreferences;
  const propagateSettingsToIframesRef = useRef(propagateSettingsToIframes);
  propagateSettingsToIframesRef.current = propagateSettingsToIframes;

  // Keep ref in sync with state for message listeners
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Serialize so effect does not re-run on every new session object / rotated access_token.
  const sessionUserPreferencesKey = JSON.stringify(session?.userPreferences ?? null);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window || !session?.accessToken) {
      return;
    }

    let cancelled = false;
    loadingPreferencesRef.current = true;

    const loadPreferences = async () => {
      try {
        const tokenPreferences = session?.userPreferences ?? null;
        if (tokenPreferences) {
          const currentSettings = settingsRef.current ?? defaultSettings;
          const mergedSettings = mergePreferencesIntoSettings(currentSettings, tokenPreferences);
          const signature = JSON.stringify(getPreferenceSnapshot(mergedSettings));
          const prevSignature = JSON.stringify(getPreferenceSnapshot(currentSettings));
          lastSyncedPreferencesRef.current = signature;
          if (signature === prevSignature) {
            logger.info('JWT app preferences match current settings; skipping state update', {
              preferences: getPreferenceSnapshot(mergedSettings),
            });
            return;
          }
          settingsRef.current = mergedSettings;
          setSettings(mergedSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));
          propagateSettingsToIframesRef.current(mergedSettings);
          logger.info('Loaded app preferences from JWT metadata', {
            preferences: getPreferenceSnapshot(mergedSettings),
          });
          return;
        }

        const preferences = await loadUserPreferencesRef.current();

        if (cancelled) return;

        if (!preferences) {
          const currentSettings = settingsRef.current ?? defaultSettings;
          const currentPreferences = getPreferenceSnapshot(currentSettings);
          const signature = JSON.stringify(currentPreferences);
          try {
            await syncUserPreferencesRef.current(currentPreferences);
            if (cancelled) return;
            lastSyncedPreferencesRef.current = signature;
            logger.info('No auth provider preferences found; seeded with current app preferences', {
              preferences: currentPreferences,
            });
          } catch (error) {
            if (!cancelled) {
              logger.error('Failed to seed auth provider preferences from current app settings', {
                error,
              });
            }
          }
          return;
        }

        const currentSettings = settingsRef.current ?? defaultSettings;
        const mergedSettings = mergePreferencesIntoSettings(currentSettings, preferences);
        const signature = JSON.stringify(getPreferenceSnapshot(mergedSettings));
        const prevSignature = JSON.stringify(getPreferenceSnapshot(currentSettings));
        lastSyncedPreferencesRef.current = signature;
        if (signature === prevSignature) {
          logger.info('Auth provider preferences match current settings; skipping state update', {
            preferences: getPreferenceSnapshot(mergedSettings),
          });
          return;
        }
        settingsRef.current = mergedSettings;
        setSettings(mergedSettings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));

        propagateSettingsToIframesRef.current(mergedSettings);

        logger.info('Loaded app preferences from auth provider metadata', {
          preferences: getPreferenceSnapshot(mergedSettings),
        });
      } catch (error) {
        logger.error('Failed to load app preferences from auth provider metadata', { error });
      } finally {
        loadingPreferencesRef.current = false;
      }
    };

    void loadPreferences();
    return () => {
      cancelled = true;
      loadingPreferencesRef.current = false;
    };
  }, [session?.userId, sessionUserPreferencesKey]);

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
      propagateSettingsToIframes(nextSettings);
    } catch (error) {
      logger.error('Failed to sync auth user into settings:', { error });
    }
  }, [authUser, config]);

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
          const shouldStripSensitiveFields = window.parent === window;
          const nextSettings = shouldStripSensitiveFields
            ? stripSensitiveUserFields(newSettings)
            : newSettings;
          // Update localStorage with new settings value
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
          if (window.parent === window) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
              logger.info('Root Parent received settings update', { message });
              propagateSettingsToIframes(nextSettings);
            } catch (error) {
              logger.error('Failed to update settings from message:', { error });
            }
          }
        }
      },
    );

    const cleanupSettingsRequested = shellui.addMessageListener(
      'SHELLUI_SETTINGS_REQUESTED',
      (message: ShellUIMessage) => {
        // Use ref to always get current settings (avoids stale closure)
        const currentSettings = settingsRef.current ?? defaultSettings;
        const requestingPath = (message.from ?? []).filter(Boolean);

        if (requestingPath.length > 0) {
          const [firstHopIframeUuid] = requestingPath;
          const frame = shellui.frameRegistry
            .getAllIframes()
            .find(([uuid]) => uuid === firstHopIframeUuid)?.[1];
          const lang = currentSettings.language?.code || 'en';
          const includeAuthAccessToken = frame
            ? isTrustedFrameForAuthToken(frame.src ?? '')
            : false;
          const settingsToPropagate = buildSettingsForPropagation(currentSettings, config, lang, {
            includeAuthAccessToken,
            accessToken: session?.accessToken ?? null,
          });

          // Route through the full parent -> child -> ... -> requester path so deep descendants
          // receive settings even when they are nested more than one level under root.
          shellui.sendMessage({
            type: 'SHELLUI_SETTINGS',
            payload: { settings: settingsToPropagate },
            to: requestingPath,
          });
          return;
        }
        propagateSettingsToIframes(currentSettings);
      },
    );

    const cleanupSettings = shellui.addMessageListener(
      'SHELLUI_SETTINGS',
      (data: ShellUIMessage) => {
        const message = data as ShellUIMessage;
        const payload = message.payload as { settings: Settings };
        const newSettings = payload.settings;
        if (newSettings) {
          const shouldStripSensitiveFields = window.parent === window;
          const nextSettings = shouldStripSensitiveFields
            ? stripSensitiveUserFields(newSettings)
            : newSettings;
          settingsRef.current = nextSettings;
          setSettings(nextSettings);

          // Forward settings down the iframe tree so deep descendants also update.
          if (window.parent !== window) {
            propagateSettingsToIframes(nextSettings);
          }
        }
      },
    );

    return () => {
      cleanup();
      cleanupSettings();
      cleanupSettingsRequested();
    };
  }, [config, isTrustedFrameForAuthToken, propagateSettingsToIframes, session?.accessToken]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.parent !== window ||
      loadingPreferencesRef.current
    ) {
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
        await syncUserPreferencesRef.current(preferences);
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
  }, [settings]);

  // ACTIONS
  const updateSettings = useCallback(
    (updates: Partial<Settings>) => {
      const nextSettings = { ...settings, ...updates };

      // Update localStorage and propagate to children if we're in the root window
      if (typeof window !== 'undefined' && window.parent === window) {
        try {
          const newSettings = stripSensitiveUserFields(nextSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          settingsRef.current = newSettings;
          setSettings(newSettings);
          // Propagate to child iframes (sendMessageToParent does nothing in root)
          propagateSettingsToIframes(newSettings);
        } catch (error) {
          logger.error('Failed to update settings in localStorage:', { error });
        }
      }
      if (typeof window !== 'undefined' && window.parent !== window) {
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
      }

      // For child iframes, send to parent (parent will propagate to siblings)
      shellui.sendMessageToParent({
        type: 'SHELLUI_SETTINGS_UPDATED',
        payload: { settings: stripSensitiveUserFields(nextSettings) },
      });
    },
    [settings, propagateSettingsToIframes],
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
        // Force logout so in-memory auth state is also reset.
        void logout();

        // Clear settings
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        localStorage.removeItem(AUTH_LAST_USED_LOGIN_STORAGE_KEY);

        // Clear all other localStorage items that start with shellui:
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('shellui:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Stop any active service worker after reset (default is disabled)
        void unregisterServiceWorker();

        // Reset settings to defaults
        const newSettings = defaultSettings;
        settingsRef.current = newSettings;
        setSettings(newSettings);

        // If we're in the root window, update localStorage with defaults
        if (window.parent === window) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          propagateSettingsToIframes(newSettings);
        }

        // Notify parent about reset
        shellui.sendMessageToParent({
          type: 'SHELLUI_SETTINGS_UPDATED',
          payload: { settings: newSettings },
        });
        shellui.sendMessageToParent({
          type: 'SHELLUI_LOGOUT',
          payload: {},
        });

        logger.info('All app data has been reset');
      } catch (error) {
        logger.error('Failed to reset all data:', { error });
      }
    }
  }, [logout, propagateSettingsToIframes]);

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
