import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  bindVisibleResume,
  CHILD_FRAME_SESSION,
  deliverSessionHandoff,
  getLogger,
  shellui,
  type ShellUIMessage,
  type Settings,
  type Appearance,
} from '@shellui/sdk';
import { SettingsContext } from './SettingsContext';
import { useConfig } from '../config/useConfig';
import { useAuth } from '../auth/hooks/useAuth';
import {
  childFrameAuthPropagationOptions,
  frameAuthPropagationOptions,
} from '../auth/appBackend/frameAuth';
import {
  addChildFrame,
  findChildFrame,
  listChildFrames,
  removeChildFrame,
  validateChildFrameRegistration,
  type ChildFrameEntry,
} from '../auth/appBackend/childFrames';
import { resolveFrameNavigationItem } from '../auth/appBackend/identity';
import { describeAppSessionFailure } from '../auth/appBackend/tokenExchange';

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}
import {
  ensureAppBackendSession,
  allowSilentRetry,
  getAppBackendSessionFailure,
  getAppBackendSession,
  refreshAppBackendSessionIfDue,
  subscribeAppBackendSessions,
} from '../auth/appBackend/appBackendSessions';
import { isMainLayoutFrame } from '../layouts/floating/layoutChromeStore';
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
import { refreshFrameAccessTokenIfNeeded } from '../auth/utils/frameSessionRefresher';

const logger = getLogger('shellcore');

const STORAGE_KEY = 'shellui:settings';
const AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';
const AUTH_LAST_USED_LOGIN_STORAGE_KEY = 'shellui.auth.last_used_login';

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
    disableTokenAutoRefresh: false,
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
  ai: {
    enabled: true,
    defaultModelId: null,
    ollamaEnabled: true,
    browserEnabled: true,
  },
  user: null,
  accessToken: null,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const { user: authUser, session, syncUserPreferences, loadUserPreferences, logout } = useAuth();
  const lastSyncedPreferencesRef = useRef<string | null>(null);
  const loadingPreferencesRef = useRef(false);
  const settingsHydratedFromStorageRef = useRef(false);
  // Use a ref to always have current settings for message listeners (avoids closure issues)
  const settingsRef = useRef<Settings | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    let initialSettings: Settings;

    if (shellui.initialSettings) {
      initialSettings = shellui.initialSettings;
      settingsRef.current = initialSettings;
      settingsHydratedFromStorageRef.current = true;
      return initialSettings;
    }

    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          settingsHydratedFromStorageRef.current = true;
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
            developerFeatures: {
              enabled:
                parsed.developerFeatures?.enabled ?? defaultSettings.developerFeatures.enabled,
              disableTokenAutoRefresh:
                parsed.developerFeatures?.disableTokenAutoRefresh ??
                defaultSettings.developerFeatures.disableTokenAutoRefresh,
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
            ai: {
              enabled: parsed.ai?.enabled ?? defaultSettings.ai.enabled,
              defaultModelId:
                parsed.ai?.defaultModelId !== undefined
                  ? parsed.ai.defaultModelId
                  : defaultSettings.ai.defaultModelId,
              ollamaEnabled: parsed.ai?.ollamaEnabled ?? defaultSettings.ai.ollamaEnabled,
              browserEnabled: parsed.ai?.browserEnabled ?? defaultSettings.ai.browserEnabled,
              ollamaBaseUrl: parsed.ai?.ollamaBaseUrl ?? defaultSettings.ai.ollamaBaseUrl,
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

  const accessTokenRef = useRef<string | null>(session?.accessToken ?? null);
  accessTokenRef.current = session?.accessToken ?? null;

  const authOptionsForFrame = useCallback(
    (frameSrc: string) =>
      frameAuthPropagationOptions({
        frameSrc,
        config,
        shellAccessToken: accessTokenRef.current,
        getAppSession: getAppBackendSession,
      }),
    [config],
  );

  /** Settings for a child app hosted by an embedded app. Never carries the shell token. */
  const pushSettingsToChildFrame = useCallback(
    (entry: ChildFrameEntry | null, path: string[], baseSettings: Settings) => {
      const lang = baseSettings.language?.code || 'en';
      const settingsToPropagate = buildSettingsForPropagation(baseSettings, config, lang, {
        ...childFrameAuthPropagationOptions({
          identity: entry?.identity ?? null,
          getAppSession: getAppBackendSession,
          services: entry?.services ?? null,
        }),
        includeLayoutChrome: false,
        frameUuid: path[path.length - 1],
      });
      shellui.sendMessage({
        type: 'SHELLUI_SETTINGS',
        payload: { settings: settingsToPropagate },
        to: path,
      });
    },
    [config],
  );

  const propagateSettingsToChildFrames = useCallback(
    (baseSettings: Settings) => {
      const live = new Set(shellui.frameRegistry.getLiveIframes().map(([uuid]) => uuid));
      const known = new Set(shellui.frameRegistry.getAllIframes().map(([uuid]) => uuid));
      for (const entry of listChildFrames((uuid) => known.has(uuid))) {
        if (!live.has(entry.hostUuid)) continue;
        pushSettingsToChildFrame(entry, [entry.hostUuid, entry.frameId], baseSettings);
      }
    },
    [pushSettingsToChildFrame],
  );

  const propagateSettingsToIframes = useCallback(
    (baseSettings: Settings) => {
      const iframes = shellui.frameRegistry.getLiveIframes();
      if (iframes.length === 0) return;
      propagateSettingsToChildFrames(baseSettings);
      const lang = baseSettings.language?.code || 'en';
      for (const [uuid, iframe] of iframes) {
        const frameSrc = iframe?.src ?? '';
        const settingsToPropagate = buildSettingsForPropagation(baseSettings, config, lang, {
          ...authOptionsForFrame(frameSrc),
          includeLayoutChrome: isMainLayoutFrame(iframe),
          frameUuid: uuid,
        });
        shellui.sendMessage({
          type: 'SHELLUI_SETTINGS',
          payload: { settings: settingsToPropagate },
          to: [uuid],
        });
      }
    },
    [authOptionsForFrame, config, propagateSettingsToChildFrames],
  );

  const pushSettingsToFrame = useCallback(
    (iframeUuid: string, frameSrc: string, baseSettings: Settings) => {
      const lang = baseSettings.language?.code || 'en';
      const iframe = shellui.frameRegistry
        .getAllIframes()
        .find(([uuid]) => uuid === iframeUuid)?.[1];
      const settingsToPropagate = buildSettingsForPropagation(baseSettings, config, lang, {
        ...authOptionsForFrame(frameSrc),
        includeLayoutChrome: isMainLayoutFrame(iframe),
        frameUuid: iframeUuid,
      });
      shellui.sendMessage({
        type: 'SHELLUI_SETTINGS',
        payload: { settings: settingsToPropagate },
        to: [iframeUuid],
      });
    },
    [authOptionsForFrame, config],
  );

  const applyHandoffToken = useCallback((token: string | null | undefined) => {
    if (token !== undefined) accessTokenRef.current = token;
  }, []);

  const handoffSettingsToIframes = useCallback(() => {
    const base = settingsRef.current ?? defaultSettings;
    return deliverSessionHandoff(() => propagateSettingsToIframes(base));
  }, [propagateSettingsToIframes]);

  useEffect(() => {
    return subscribeAppBackendSessions(() => {
      if (typeof window === 'undefined' || window.parent !== window) return;
      handoffSettingsToIframes();
    });
  }, [handoffSettingsToIframes]);

  // When the shell rotates the JWT, `authUser` often does not change, so the user-sync effect
  // above skips — still push `SHELLUI_SETTINGS` so trusted iframes get the new `accessToken`.
  // The follow-up turn covers an app that subscribes after the first post.
  const accessTokenForChildren = session?.accessToken ?? null;
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window || !accessTokenForChildren) {
      return;
    }
    return handoffSettingsToIframes();
  }, [accessTokenForChildren, handoffSettingsToIframes]);

  // Background tabs throttle the refresh interval. On show, refresh if due and
  // re-send the session even when the token string did not change.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) return;
    return bindVisibleResume(() => {
      void (async () => {
        const token = await refreshFrameAccessTokenIfNeeded();
        applyHandoffToken(token);
        handoffSettingsToIframes();
      })();
    });
  }, [applyHandoffToken, handoffSettingsToIframes]);

  // Keep load/sync helpers stable across access-token rotation (refresh after preference sync).
  const loadUserPreferencesRef = useRef(loadUserPreferences);
  loadUserPreferencesRef.current = loadUserPreferences;
  const syncUserPreferencesRef = useRef(syncUserPreferences);
  syncUserPreferencesRef.current = syncUserPreferences;
  const propagateSettingsToIframesRef = useRef(propagateSettingsToIframes);
  propagateSettingsToIframesRef.current = propagateSettingsToIframes;

  // Trailing-debounce iframe settings pushes during rapid theme spam so
  // children only apply the final theme after switching settles.
  const pendingIframeSettingsRef = useRef<Settings | null>(null);
  const iframePropagateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePropagateSettingsToIframes = useCallback((next: Settings) => {
    pendingIframeSettingsRef.current = next;
    if (iframePropagateTimerRef.current !== null) {
      clearTimeout(iframePropagateTimerRef.current);
    }
    iframePropagateTimerRef.current = setTimeout(() => {
      iframePropagateTimerRef.current = null;
      const pending = pendingIframeSettingsRef.current;
      pendingIframeSettingsRef.current = null;
      if (pending) {
        propagateSettingsToIframesRef.current(pending);
      }
    }, 100);
  }, []);

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
          if (signature === prevSignature) {
            lastSyncedPreferencesRef.current = signature;
            logger.info('JWT app preferences match current settings; skipping state update', {
              preferences: getPreferenceSnapshot(mergedSettings),
            });
            return;
          }
          // Current UI already matches what we last synced — JWT is lagging a newer
          // local change (or a superseded sync). Don’t regress appearance.
          if (prevSignature === lastSyncedPreferencesRef.current) {
            logger.info('Ignoring stale JWT preferences that lag last-synced settings', {
              jwt: getPreferenceSnapshot(mergedSettings),
              current: getPreferenceSnapshot(currentSettings),
            });
            return;
          }
          lastSyncedPreferencesRef.current = signature;
          settingsRef.current = mergedSettings;
          setSettings(mergedSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSettings));
          schedulePropagateSettingsToIframes(mergedSettings);
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

  // Listen for settings updates from parent/other nodes.
  // useLayoutEffect so SETTINGS_REQUESTED handlers exist before companion paint races.
  useLayoutEffect(() => {
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
              // Coalesce with rapid theme spam (same debounce as updateSettings).
              schedulePropagateSettingsToIframes(nextSettings);
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
        void (async () => {
          // An app that asks while the access token is expired must get a fresh one,
          // not the JWT that died while the tab was hidden.
          const token = await refreshFrameAccessTokenIfNeeded();
          applyHandoffToken(token);
          const requestingPath = (message.from ?? []).filter(Boolean);
          const [firstHopIframeUuid] = requestingPath;
          const requestingFrame = firstHopIframeUuid
            ? shellui.frameRegistry
                .getAllIframes()
                .find(([uuid]) => uuid === firstHopIframeUuid)?.[1]
            : undefined;
          // A child app hosted by an embedded app gets its own session, never the host's.
          const childEntry = findChildFrame(requestingPath);
          const hostEmbedsApps = Boolean(
            requestingFrame?.src &&
            resolveFrameNavigationItem(requestingFrame.src, config)?.childFrames,
          );
          const isHostedChild = requestingPath.length > 1 && (childEntry || hostEmbedsApps);
          if (isHostedChild) {
            if (childEntry?.identity) {
              await ensureAppBackendSession(childEntry.identity, { allowSilent: true });
            }
            deliverSessionHandoff(() =>
              pushSettingsToChildFrame(
                childEntry,
                requestingPath,
                settingsRef.current ?? defaultSettings,
              ),
            );
            return;
          }
          if (requestingFrame?.src) {
            await refreshAppBackendSessionIfDue(requestingFrame.src, config);
          }

          const send = () => {
            const currentSettings = settingsRef.current ?? defaultSettings;

            if (requestingPath.length > 0) {
              const lang = currentSettings.language?.code || 'en';
              const frameSrc = requestingFrame?.src ?? '';
              const settingsToPropagate = buildSettingsForPropagation(
                currentSettings,
                config,
                lang,
                {
                  ...authOptionsForFrame(frameSrc),
                  includeLayoutChrome: isMainLayoutFrame(requestingFrame),
                  frameUuid: firstHopIframeUuid,
                },
              );

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
          };

          deliverSessionHandoff(send);
        })();
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

    // After an iframe finishes SDK init, re-push current settings (incl. rotated JWT).
    // Covers races where the frame registered after a refresh broadcast, or remounted.
    const cleanupInitialized = shellui.addMessageListener(
      'SHELLUI_INITIALIZED',
      (_message: ShellUIMessage, event: MessageEvent) => {
        if (typeof window === 'undefined' || window.parent !== window) {
          return;
        }
        const source = event.source;
        if (!source) return;
        const match = shellui.frameRegistry
          .getAllIframes()
          .find(([, iframe]) => iframe?.contentWindow === source);
        if (!match) return;
        const [iframeUuid, iframe] = match;
        void (async () => {
          const token = await refreshFrameAccessTokenIfNeeded();
          applyHandoffToken(token);
          const frameSrc = iframe?.src ?? '';
          if (frameSrc) await refreshAppBackendSessionIfDue(frameSrc, config);
          deliverSessionHandoff(() =>
            pushSettingsToFrame(iframeUuid, frameSrc, settingsRef.current ?? defaultSettings),
          );
        })();
      },
    );

    const cleanupChildRegister = shellui.addMessageListener(
      'SHELLUI_CHILD_FRAME_REGISTER',
      (message: ShellUIMessage) => {
        if (typeof window === 'undefined' || window.parent !== window) return;
        const from = (message.from ?? []).filter(Boolean);
        const hostSrc = shellui.frameRegistry
          .getAllIframes()
          .find(([uuid]) => uuid === from[0])?.[1]?.src;
        const result = validateChildFrameRegistration({
          from,
          hostSrc,
          payload: message.payload,
          config,
        });
        if (!result.ok) {
          logger.warn('Rejected a child app frame', { reason: result.reason });
          return;
        }
        addChildFrame(result.entry);
        const { entry } = result;
        if (entry.rejectedServices.length) {
          // Keys only: the URLs themselves stay out of the log.
          logger.warn('Dropped child app service URLs not in childFrames.serviceOrigins', {
            origin: safeOrigin(entry.url),
            services: entry.rejectedServices,
          });
        }
        logger.info('Child app frame registered', {
          origin: safeOrigin(entry.url),
          identity: entry.identity?.url ?? null,
          companyId: entry.identity?.companyId ?? null,
        });
        void (async () => {
          let ok = true;
          let reason: string | null = null;
          if (entry.identity) {
            // A (re)registration is a fresh mount or a user retry: allow one more silent try.
            allowSilentRetry(entry.identity.key);
            const token = await ensureAppBackendSession(entry.identity, { allowSilent: true });
            ok = Boolean(token);
            reason = ok ? null : (getAppBackendSessionFailure(entry.identity.key) ?? 'no_session');
          }
          shellui.sendMessage({
            type: CHILD_FRAME_SESSION,
            payload: {
              frameId: entry.frameId,
              ok,
              ...(reason ? { reason, hint: describeAppSessionFailure(reason) } : {}),
            } as unknown as ShellUIMessage['payload'],
            to: [entry.hostUuid],
          });
          logger.info('Child app frame session', { origin: safeOrigin(entry.url), ok, reason });
          deliverSessionHandoff(() =>
            pushSettingsToChildFrame(
              entry,
              [entry.hostUuid, entry.frameId],
              settingsRef.current ?? defaultSettings,
            ),
          );
        })();
      },
    );

    const cleanupChildUnregister = shellui.addMessageListener(
      'SHELLUI_CHILD_FRAME_UNREGISTER',
      (message: ShellUIMessage) => {
        const from = (message.from ?? []).filter(Boolean);
        const frameId = (message.payload as { frameId?: unknown } | null)?.frameId;
        if (from.length !== 1 || typeof frameId !== 'string') return;
        removeChildFrame(from[0], frameId);
      },
    );

    return () => {
      cleanup();
      cleanupSettings();
      cleanupSettingsRequested();
      cleanupInitialized();
      cleanupChildRegister();
      cleanupChildUnregister();
    };
  }, [
    pushSettingsToChildFrame,
    authOptionsForFrame,
    config,
    applyHandoffToken,
    propagateSettingsToIframes,
    pushSettingsToFrame,
    schedulePropagateSettingsToIframes,
  ]);

  // Apply config activeTheme / defaultTheme on first visit (no localStorage preference yet)
  useEffect(() => {
    if (settingsHydratedFromStorageRef.current) return;
    const desired = config?.activeTheme || config?.defaultTheme;
    if (!desired) return;
    setSettings((prev) => {
      if (prev.appearance?.name === desired) return prev;
      const themeFromConfig = Array.isArray(config?.themes)
        ? config.themes.find(
            (t) =>
              t && typeof t === 'object' && 'name' in t && (t as { name: string }).name === desired,
          )
        : undefined;
      const typed =
        themeFromConfig && typeof themeFromConfig === 'object' && 'displayName' in themeFromConfig
          ? (themeFromConfig as {
              displayName: string;
              colors: Appearance['colors'];
            })
          : undefined;
      const next: Settings = {
        ...prev,
        appearance: {
          ...prev.appearance,
          name: desired,
          ...(typed
            ? {
                displayName: typed.displayName,
                colors: typed.colors,
              }
            : {}),
        },
      };
      settingsRef.current = next;
      return next;
    });
  }, [config?.activeTheme, config?.defaultTheme, config?.themes]);

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
      // Always merge from the latest ref so rapid theme toggles don’t clobber each other.
      const base = settingsRef.current ?? defaultSettings;
      const nextSettings = { ...base, ...updates };

      // Update localStorage and propagate to children if we're in the root window
      if (typeof window !== 'undefined' && window.parent === window) {
        try {
          const newSettings = stripSensitiveUserFields(nextSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          settingsRef.current = newSettings;
          setSettings(newSettings);
          // Trailing coalesce: spam theme switches only push the latest to iframes
          schedulePropagateSettingsToIframes(newSettings);
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
    [schedulePropagateSettingsToIframes],
  );

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, updates: Partial<Settings[K]>) => {
      // Deep merge from latest ref: preserve existing nested properties
      const base = settingsRef.current ?? defaultSettings;
      const currentValue = base[key];
      const mergedValue =
        typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
          ? { ...currentValue, ...updates }
          : updates;
      updateSettings({ [key]: mergedValue } as Partial<Settings>);
    },
    [updateSettings],
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
