import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getLogger,
  sanitizeCapabilityList,
  shellui,
  MARKETPLACE_INSTALL,
  MARKETPLACE_INSTALL_RESULT,
  MARKETPLACE_LIST,
  MARKETPLACE_LIST_RESULT,
  MARKETPLACE_UNINSTALL,
  MARKETPLACE_UNINSTALL_RESULT,
  type ShellUIMessage,
} from '@shellui/sdk';
import { useAuth } from '../auth/hooks/useAuth';
import { flattenNavigationItems } from '../layouts/utils';
import { ConfigContext } from '../config/ConfigProvider';
import { useConfig } from '../config/useConfig';
import { InstallConfirmDialog } from './InstallConfirmDialog';
import {
  prepareInstall,
  staticNavigationOrigins,
  upsertInstalledApp,
  type InstallSummary,
  type MarketplaceInstallRequest,
} from './installApp';
import { replaceInstalledAppRecords } from './installedAppRegistry';
import {
  createMarketplaceNavigationItem,
  mergeNavigationOverlay,
  type NavigationEntry,
} from './mergeNavigation';
import { marketplaceOrigin, normalizeMarketplaceConfig } from './normalizeMarketplaceConfig';
import { emptyNavigationOverlay, type InstalledAppRecord, type NavigationOverlay } from './overlay';
import { applyNavigationMessageSecurity } from './securitySync';
import { createNavigationStorageAdapter, isIdentityConfigured } from './storage';

const logger = getLogger('shellcore');

export interface NavigationContextValue {
  installedApps: InstalledAppRecord[];
  listInstalledApps: () => InstalledAppRecord[];
  uninstallApp: (appId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  setAppCapabilities: (
    appId: string,
    capabilities: readonly string[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const value = useContext(NavigationContext);
  if (!value) {
    throw new Error('useNavigation must be used within a NavigationProvider.');
  }
  return value;
}

type PendingConfirm = {
  summary: InstallSummary;
  resolve: (accepted: boolean) => void;
};

function reply(type: string, payload: Record<string, unknown>, frameId: string | undefined): void {
  shellui.sendMessage({
    type,
    payload,
    ...(frameId ? { to: [frameId] } : {}),
  });
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { config: base } = useConfig();
  const { session } = useAuth();
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = session?.accessToken ?? null;
  const [overlay, setOverlay] = useState<NavigationOverlay | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const overlayRef = useRef<NavigationOverlay | null>(null);
  const knownUrlsRef = useRef<Set<string>>(new Set());
  overlayRef.current = overlay;

  const marketplace = useMemo(
    () => normalizeMarketplaceConfig(base.marketplace),
    [base.marketplace],
  );
  const customizationOn =
    marketplace?.navigationCustomization.enabled !== false && Boolean(marketplace);

  const mergedNavigation = useMemo<NavigationEntry[]>(() => {
    if (!marketplace) return base.navigation ?? [];
    return mergeNavigationOverlay(
      base.navigation,
      customizationOn ? overlay : null,
      createMarketplaceNavigationItem(marketplace.url),
    );
  }, [base.navigation, customizationOn, marketplace, overlay]);

  const effectiveConfig = useMemo(() => {
    if (!marketplace) return base;
    return { ...base, navigation: mergedNavigation };
  }, [base, marketplace, mergedNavigation]);

  const adapter = useMemo(() => {
    if (!marketplace) return null;
    return createNavigationStorageAdapter({
      mode: marketplace.navigationCustomization.storage,
      identityConfigured: isIdentityConfigured(base, marketplace.navigationCustomization.apiUrl),
      isSignedIn: () => Boolean(tokenRef.current),
      getAccessToken: () => tokenRef.current,
      identityBaseUrl: base.backend?.type === 'shellui' ? (base.backend.url ?? null) : null,
      apiUrl: marketplace.navigationCustomization.apiUrl ?? null,
    });
  }, [base, marketplace]);

  useEffect(() => {
    if (!adapter || !customizationOn) return;
    let cancelled = false;
    adapter
      .load()
      .then((loaded) => {
        if (!cancelled) setOverlay(loaded ?? emptyNavigationOverlay());
      })
      .catch((error: unknown) => {
        logger.warn('Navigation overlay could not be loaded', { error });
        if (!cancelled) setOverlay(emptyNavigationOverlay());
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, customizationOn, session?.accessToken]);

  const apps = customizationOn ? (overlay?.installedApps ?? []) : [];

  if (typeof window !== 'undefined') {
    const removedUrls = [...knownUrlsRef.current].filter(
      (url) => !apps.some((app) => app.url === url),
    );
    knownUrlsRef.current = new Set(apps.map((app) => app.url));
    replaceInstalledAppRecords(apps);
    applyNavigationMessageSecurity({
      config: base,
      navigation: mergedNavigation,
      apps,
      marketplaceOrigin: marketplace ? marketplaceOrigin(marketplace.url) : null,
      removedAppUrls: removedUrls,
    });
  }

  const persist = useCallback(
    async (next: NavigationOverlay) => {
      setOverlay(next);
      overlayRef.current = next;
      if (adapter) await adapter.save(next);
    },
    [adapter],
  );

  const currentOverlay = useCallback((): NavigationOverlay => {
    return overlayRef.current ?? emptyNavigationOverlay();
  }, []);

  const askConfirm = useCallback((summary: InstallSummary) => {
    return new Promise<boolean>((resolve) => {
      const next = { summary, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settleConfirm = useCallback((accepted: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(accepted);
  }, []);

  const uninstallApp = useCallback(
    async (appId: string) => {
      if (!marketplace || !customizationOn)
        return { ok: false as const, error: 'marketplace_disabled' };
      const current = currentOverlay();
      const existing = current.installedApps.find((app) => app.id === appId);
      if (!existing) return { ok: false as const, error: 'not_found' };
      const now = new Date().toISOString();
      const next: NavigationOverlay = {
        ...current,
        installedApps: current.installedApps.filter((app) => app.id !== appId),
        order: current.order.filter((path) => path !== existing.path),
        hiddenPaths: current.hiddenPaths.filter((path) => path !== existing.path),
        updatedAt: now,
      };
      await persist(next);
      return { ok: true as const };
    },
    [currentOverlay, customizationOn, marketplace, persist],
  );

  const setAppCapabilities = useCallback(
    async (appId: string, capabilities: readonly string[]) => {
      if (!marketplace || !customizationOn)
        return { ok: false as const, error: 'marketplace_disabled' };
      const current = currentOverlay();
      const existing = current.installedApps.find((app) => app.id === appId);
      if (!existing) return { ok: false as const, error: 'not_found' };
      const now = new Date().toISOString();
      const nextCaps = sanitizeCapabilityList(
        ['theme', 'locale', ...capabilities.filter((capability) => capability !== 'auth')],
        existing.thirdParty,
      );
      const next: NavigationOverlay = {
        ...current,
        installedApps: current.installedApps.map((app) =>
          app.id === appId ? { ...app, capabilities: nextCaps, updatedAt: now } : app,
        ),
        updatedAt: now,
      };
      await persist(next);
      return { ok: true as const };
    },
    [currentOverlay, customizationOn, marketplace, persist],
  );

  const installFromMarketplace = useCallback(
    async (request: MarketplaceInstallRequest) => {
      if (!marketplace) return { ok: false as const, error: 'marketplace_disabled' };
      if (!customizationOn)
        return { ok: false as const, error: 'navigation_customization_disabled' };
      const current = currentOverlay();
      const staticItems = flattenNavigationItems(base.navigation ?? []);
      const prepared = prepareInstall(request, {
        allowThirdParty: marketplace.allowThirdParty,
        now: new Date().toISOString(),
        takenPaths: new Set([
          ...staticItems.map((item) => item.path),
          ...current.installedApps.map((app) => app.path),
          'marketplace',
        ]),
        staticOrigins: staticNavigationOrigins([
          ...staticItems,
          createMarketplaceNavigationItem(marketplace.url),
        ]),
        shellOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      });
      if (!prepared.ok) return prepared;
      if (prepared.needsConfirmation) {
        const accepted = await askConfirm(prepared.summary);
        if (!accepted) return { ok: false as const, error: 'confirmation_declined' };
      }
      const existing = current.installedApps.find((app) => app.id === prepared.record.id);
      const record = existing
        ? {
            ...prepared.record,
            path: existing.path,
            installedAt: existing.installedAt,
            updatedAt: prepared.record.updatedAt,
          }
        : prepared.record;
      const installedApps = upsertInstalledApp(current.installedApps, record);
      const next: NavigationOverlay = {
        ...current,
        installedApps,
        order: current.order.includes(record.path)
          ? current.order
          : [...current.order, record.path],
        updatedAt: record.updatedAt,
      };
      await persist(next);
      return { ok: true as const, app: record };
    },
    [askConfirm, base.navigation, currentOverlay, customizationOn, marketplace, persist],
  );

  useEffect(() => {
    if (!marketplace) return;
    const expectedOrigin = marketplaceOrigin(marketplace.url);
    const frameIdOf = (message: ShellUIMessage) => message.from?.find(Boolean);

    const onList = (message: ShellUIMessage, event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      reply(
        MARKETPLACE_LIST_RESULT,
        {
          id: (message.payload as { id?: string } | undefined)?.id,
          ok: true,
          apps: overlayRef.current?.installedApps ?? [],
        },
        frameIdOf(message),
      );
    };

    const onInstall = (message: ShellUIMessage, event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      const payload = message.payload as
        | { id?: string; request?: MarketplaceInstallRequest }
        | undefined;
      void installFromMarketplace(payload?.request ?? {}).then((result) => {
        reply(
          MARKETPLACE_INSTALL_RESULT,
          result.ok
            ? { id: payload?.id, ok: true, app: result.app }
            : { id: payload?.id, ok: false, error: result.error },
          frameIdOf(message),
        );
      });
    };

    const onUninstall = (message: ShellUIMessage, event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      const payload = message.payload as { id?: string; appId?: string } | undefined;
      void uninstallApp(payload?.appId ?? '').then((result) => {
        reply(
          MARKETPLACE_UNINSTALL_RESULT,
          result.ok
            ? { id: payload?.id, ok: true }
            : { id: payload?.id, ok: false, error: result.error },
          frameIdOf(message),
        );
      });
    };

    const stopList = shellui.addMessageListener(MARKETPLACE_LIST, onList);
    const stopInstall = shellui.addMessageListener(MARKETPLACE_INSTALL, onInstall);
    const stopUninstall = shellui.addMessageListener(MARKETPLACE_UNINSTALL, onUninstall);
    return () => {
      stopList();
      stopInstall();
      stopUninstall();
    };
  }, [installFromMarketplace, marketplace, uninstallApp]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      installedApps: customizationOn ? (overlay?.installedApps ?? []) : [],
      listInstalledApps: () => overlayRef.current?.installedApps ?? [],
      uninstallApp,
      setAppCapabilities,
    }),
    [customizationOn, overlay, setAppCapabilities, uninstallApp],
  );

  const tree = (
    <NavigationContext.Provider value={value}>
      {children}
      <InstallConfirmDialog
        summary={pending?.summary ?? null}
        onConfirm={() => settleConfirm(true)}
        onCancel={() => settleConfirm(false)}
      />
    </NavigationContext.Provider>
  );

  if (!marketplace) return tree;
  return (
    <ConfigContext.Provider value={{ config: effectiveConfig }}>{tree}</ConfigContext.Provider>
  );
}
