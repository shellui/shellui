import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import i18n from 'i18next';
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
import { movePathInOrder, nextHiddenPaths } from './navigationCustomization';
import { ConfigContext } from '../config/ConfigProvider';
import { isShellDevelopment } from '../security/urlAllowlist';
import { useConfig } from '../config/useConfig';
import { InstallConfirmDialog } from './InstallConfirmDialog';
import {
  prepareInstall,
  upsertInstalledApp,
  type InstallSummary,
  type MarketplaceInstallRequest,
} from './installApp';
import {
  createMarketplaceNavigationItem,
  mergeNavigationOverlay,
  type NavigationEntry,
} from './mergeNavigation';
import { marketplaceOrigin, normalizeMarketplaceConfig } from './normalizeMarketplaceConfig';
import {
  applyPendingRemovals,
  readPendingRemovals,
  revokedCapabilities,
  writePendingRemovals,
  withoutUndoneRemovals,
  type PendingRemoval,
} from './narrowOverlay';
import { emptyNavigationOverlay, type InstalledAppRecord, type NavigationOverlay } from './overlay';
import { commitInstalledApps } from './securitySync';
import { createOverlayValidationContext, reservedShellPaths } from './validationContext';
import {
  NavigationOverlayConflictError,
  NavigationOverlayDeviceOnlyError,
  createNavigationStorageAdapter,
  isIdentityConfigured,
} from './storage';

const logger = getLogger('shellcore');

const CONFLICT = 'Your layout changed on another device. The latest one is shown.';
const NOT_SAVED = 'Your change was NOT saved. Try again.';

export interface NavigationContextValue {
  customizationEnabled: boolean;
  installedApps: InstalledAppRecord[];
  listInstalledApps: () => InstalledAppRecord[];
  uninstallApp: (appId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  setAppCapabilities: (
    appId: string,
    capabilities: readonly string[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  moveNavigationItem: (
    path: string,
    direction: 'up' | 'down',
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  setNavigationItemHidden: (
    path: string,
    hidden: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetNavigation: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** A removal on this device is in force but not saved to the layout yet. */
  unsavedRemovals: boolean;
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
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = session?.userId ?? null;
  const [overlay, setOverlay] = useState<NavigationOverlay | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const overlayRef = useRef<NavigationOverlay | null>(null);
  const commitSeqRef = useRef(0);
  /**
   * Removals made on this device that no successful save includes yet, for the signed-in user
   * and company only. They are kept in this tab's sessionStorage under that scope.
   */
  const pendingRemovalsRef = useRef<PendingRemoval[]>([]);
  const companyId =
    base.backend?.companyId === undefined || base.backend.companyId === null
      ? null
      : String(base.backend.companyId);
  const scope = JSON.stringify([session?.userId ?? null, companyId]);
  const scopeRef = useRef<string | null>(null);
  const [unsavedRemovals, setUnsavedRemovals] = useState(false);
  const setPendingRemovals = useCallback((removals: PendingRemoval[]) => {
    pendingRemovalsRef.current = removals;
    setUnsavedRemovals(removals.length > 0);
    if (scopeRef.current !== null) writePendingRemovals(scopeRef.current, removals);
  }, []);
  // Another account or company never inherits this one's removals.
  useLayoutEffect(() => {
    if (scopeRef.current === scope) return;
    scopeRef.current = scope;
    pendingRemovalsRef.current = readPendingRemovals(scope);
    setUnsavedRemovals(pendingRemovalsRef.current.length > 0);
  }, [scope]);

  const marketplace = useMemo(
    () => normalizeMarketplaceConfig(base.marketplace),
    [base.marketplace],
  );
  const customizationOn =
    marketplace?.navigationCustomization.enabled !== false && Boolean(marketplace);

  const mergeFor = useCallback(
    (value: NavigationOverlay | null): NavigationEntry[] => {
      if (!marketplace) return base.navigation ?? [];
      return mergeNavigationOverlay(
        base.navigation,
        customizationOn ? value : null,
        createMarketplaceNavigationItem(marketplace.url),
        reservedShellPaths(base),
      );
    },
    [base, customizationOn, marketplace],
  );
  const mergedNavigation = useMemo(() => mergeFor(overlay), [mergeFor, overlay]);

  /**
   * The only writer of the installed-app registry and the message policy. It runs when the
   * overlay changes (save, load, reset), never during render. A layout effect runs it again for
   * the committed overlay. That applies the policy at mount and on a config change before the
   * layout has loaded, and it pulls the policy back to what was committed when an update that
   * is still pending in a transition had written ahead of it.
   */
  const syncSecurity = useCallback(
    (value: NavigationOverlay | null) => {
      if (!marketplace) return;
      commitInstalledApps({
        config: base,
        navigation: mergeFor(value),
        apps: customizationOn ? (value?.installedApps ?? []) : [],
        marketplaceOrigin: marketplaceOrigin(marketplace.url),
      });
    },
    [base, customizationOn, marketplace, mergeFor],
  );

  useLayoutEffect(() => {
    syncSecurity(overlay);
  }, [overlay, syncSecurity]);

  const commitOverlay = useCallback(
    (next: NavigationOverlay) => {
      commitSeqRef.current += 1;
      overlayRef.current = next;
      syncSecurity(next);
      setOverlay(next);
    },
    [syncSecurity],
  );

  const effectiveConfig = useMemo(() => {
    if (!marketplace) return base;
    return { ...base, navigation: mergedNavigation };
  }, [base, marketplace, mergedNavigation]);

  const adapter = useMemo(() => {
    if (!marketplace) return null;
    const staticItems = [
      ...flattenNavigationItems(base.navigation ?? []),
      createMarketplaceNavigationItem(marketplace.url),
    ];
    return createNavigationStorageAdapter({
      mode: marketplace.navigationCustomization.storage,
      identityConfigured: isIdentityConfigured(base, marketplace.navigationCustomization.apiUrl),
      isSignedIn: () => Boolean(tokenRef.current),
      getAccessToken: () => tokenRef.current,
      identityBaseUrl: base.backend?.type === 'shellui' ? (base.backend.url ?? null) : null,
      apiUrl: marketplace.navigationCustomization.apiUrl ?? null,
      allowLocalhost: isShellDevelopment(),
      scope: () => ({ userId: userIdRef.current, companyId }),
      validation: () => createOverlayValidationContext({ config: base, staticItems }),
    });
  }, [base, companyId, marketplace]);

  useEffect(() => {
    if (!adapter || !customizationOn) return;
    let cancelled = false;
    adapter
      .load()
      .then((loaded) => {
        if (cancelled) return;
        commitOverlay(
          applyPendingRemovals(loaded ?? emptyNavigationOverlay(), pendingRemovalsRef.current),
        );
      })
      .catch((error: unknown) => {
        logger.warn('Navigation overlay could not be loaded', { error });
        if (!cancelled) commitOverlay(emptyNavigationOverlay());
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, commitOverlay, customizationOn, session?.accessToken, session?.userId]);

  const notify = useCallback((key: 'layoutConflict' | 'layoutNotSaved', defaultValue: string) => {
    shellui.toast({ type: 'warning', title: i18n.t(`marketplace.${key}`, { defaultValue }) });
  }, []);

  /** Load the saved identity copy after a conflict. Never the device copy. */
  const loadAfterConflict = useCallback(
    () => (adapter?.loadRemote ? adapter.loadRemote() : (adapter?.load() ?? null)),
    [adapter],
  );

  /** Forget the removals a successful save included. */
  const settleRemovals = useCallback(
    (included: readonly PendingRemoval[]) => {
      setPendingRemovals(
        pendingRemovalsRef.current.filter((removal) => !included.includes(removal)),
      );
    },
    [setPendingRemovals],
  );

  /**
   * Save the layout. Every pending removal is applied first, so the layout this device commits
   * and saves never grants what the person took away. On a conflict with another device:
   * - the newer layout is read from identity only, never from the device copy;
   * - when a newer local edit was made meanwhile, that edit resolves the conflict and carries
   *   the pending removals;
   * - otherwise the pending removals are applied to the newer layout, which is committed and
   *   saved once more. A change that only removes access then counts as saved. Any other
   *   change gives way to the newer layout, with a toast;
   * - if the newer layout cannot be read, or the second save fails, the local layout keeps the
   *   removals and the person is told plainly that the change was not saved.
   */
  const persist = useCallback(
    async (
      proposed: NavigationOverlay,
      options: { removal?: PendingRemoval | null; removalOnly?: boolean } = {},
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (options.removal) setPendingRemovals([...pendingRemovalsRef.current, options.removal]);
      const included = pendingRemovalsRef.current;
      const next = applyPendingRemovals(proposed, included);
      commitOverlay(next);
      if (!adapter) {
        settleRemovals(included);
        return { ok: true };
      }
      const sequence = commitSeqRef.current;
      try {
        await adapter.save(next);
        settleRemovals(included);
        return { ok: true };
      } catch (error) {
        // Only the device copy was written. Identity still has the older layout and wins on
        // the next load, so the removals stay pending and the person is told.
        if (error instanceof NavigationOverlayDeviceOnlyError) {
          notify('layoutNotSaved', NOT_SAVED);
          return { ok: false, error: 'not_saved' };
        }
        if (!(error instanceof NavigationOverlayConflictError)) throw error;
      }
      let remote: NavigationOverlay | null;
      try {
        remote = await loadAfterConflict();
      } catch {
        notify('layoutNotSaved', NOT_SAVED);
        return { ok: false, error: 'not_saved' };
      }
      // A newer local edit is in flight. It resolves the conflict and carries every pending
      // removal, this one included, so nothing is committed here.
      if (commitSeqRef.current !== sequence) return { ok: false, error: 'superseded' };
      const removals = pendingRemovalsRef.current;
      const merged = applyPendingRemovals(remote ?? emptyNavigationOverlay(), removals);
      commitOverlay(merged);
      if (removals.length === 0) {
        notify('layoutConflict', CONFLICT);
        return { ok: false, error: 'layout_conflict' };
      }
      try {
        await adapter.save(merged);
        settleRemovals(removals);
      } catch {
        notify('layoutNotSaved', NOT_SAVED);
        return { ok: false, error: 'not_saved' };
      }
      if (options.removalOnly) return { ok: true };
      notify('layoutConflict', CONFLICT);
      return { ok: false, error: 'layout_conflict' };
    },
    [adapter, commitOverlay, loadAfterConflict, notify, setPendingRemovals, settleRemovals],
  );

  const currentOverlay = useCallback((): NavigationOverlay => {
    return overlayRef.current ?? emptyNavigationOverlay();
  }, []);

  const installLockRef = useRef(false);

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
      return persist(
        { ...current, updatedAt: new Date().toISOString() },
        { removal: { kind: 'uninstall', appId }, removalOnly: true },
      );
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
        true,
      );
      const next: NavigationOverlay = {
        ...current,
        installedApps: current.installedApps.map((app) =>
          app.id === appId ? { ...app, capabilities: nextCaps, updatedAt: now } : app,
        ),
        updatedAt: now,
      };
      // Granting again undoes an earlier pending revoke. Taking away is kept until saved.
      setPendingRemovals(withoutUndoneRemovals(pendingRemovalsRef.current, appId, nextCaps));
      const revoked = revokedCapabilities(existing.capabilities, nextCaps);
      const widens = nextCaps.some((capability) => !existing.capabilities.includes(capability));
      return persist(next, {
        removal: revoked.length ? { kind: 'revoke', appId, capabilities: revoked } : null,
        removalOnly: !widens,
      });
    },
    [currentOverlay, customizationOn, marketplace, persist, setPendingRemovals],
  );

  const moveNavigationItem = useCallback(
    async (path: string, direction: 'up' | 'down') => {
      if (!customizationOn)
        return { ok: false as const, error: 'navigation_customization_disabled' };
      const paths = flattenNavigationItems(mergedNavigation).map((item) => item.path);
      const order = movePathInOrder(paths, path, direction);
      if (!order) return { ok: false as const, error: 'not_moved' };
      const current = currentOverlay();
      return persist({ ...current, order, updatedAt: new Date().toISOString() });
    },
    [currentOverlay, customizationOn, mergedNavigation, persist],
  );

  const setNavigationItemHidden = useCallback(
    async (path: string, hidden: boolean) => {
      if (!customizationOn)
        return { ok: false as const, error: 'navigation_customization_disabled' };
      const item = flattenNavigationItems(mergedNavigation).find((entry) => entry.path === path);
      if (!item) return { ok: false as const, error: 'not_found' };
      const current = currentOverlay();
      const next = nextHiddenPaths({
        hiddenPaths: current.hiddenPaths,
        path,
        hidden,
        locked: item.locked === true,
      });
      if (!next.ok) return next;
      return persist({
        ...current,
        hiddenPaths: next.hiddenPaths,
        updatedAt: new Date().toISOString(),
      });
    },
    [currentOverlay, customizationOn, mergedNavigation, persist],
  );

  const resetNavigation = useCallback(async () => {
    if (!customizationOn) return { ok: false as const, error: 'navigation_customization_disabled' };
    // Reset removes every installed app. Those removals stay pending until a reset succeeds, so
    // a concurrent edit or a conflict cannot bring an app back. A successful reset leaves nothing
    // to remove, so it clears every pending removal, including ones for apps already gone.
    const removals: PendingRemoval[] = currentOverlay().installedApps.map((app) => ({
      kind: 'uninstall',
      appId: app.id,
    }));
    setPendingRemovals([...pendingRemovalsRef.current, ...removals]);
    commitOverlay(emptyNavigationOverlay());
    if (!adapter?.reset) {
      setPendingRemovals([]);
      return { ok: true as const };
    }
    const sequence = commitSeqRef.current;
    try {
      await adapter.reset();
      setPendingRemovals([]);
      return { ok: true as const };
    } catch (error) {
      if (error instanceof NavigationOverlayDeviceOnlyError) {
        notify('layoutNotSaved', NOT_SAVED);
        return { ok: false as const, error: 'not_saved' };
      }
      if (!(error instanceof NavigationOverlayConflictError)) throw error;
    }
    // Another device saved first. Read its layout from identity (for the ETag), then reset
    // again, unless a newer local edit was made meanwhile. The device copy is kept until a
    // reset succeeds.
    try {
      await loadAfterConflict();
      if (commitSeqRef.current !== sequence) return { ok: false as const, error: 'superseded' };
      await adapter.reset();
      setPendingRemovals([]);
      return { ok: true as const };
    } catch {
      notify('layoutNotSaved', NOT_SAVED);
      return { ok: false as const, error: 'not_saved' };
    }
  }, [
    adapter,
    commitOverlay,
    currentOverlay,
    customizationOn,
    loadAfterConflict,
    notify,
    setPendingRemovals,
  ]);

  const installFromMarketplace = useCallback(
    async (request: MarketplaceInstallRequest) => {
      if (!marketplace) return { ok: false as const, error: 'marketplace_disabled' };
      if (!customizationOn)
        return { ok: false as const, error: 'navigation_customization_disabled' };
      // One install at a time. A second request while the dialog is open is refused, so a page
      // cannot queue installs behind a confirmation the person already answered.
      if (installLockRef.current) return { ok: false as const, error: 'install_in_progress' };
      installLockRef.current = true;
      try {
        const current = currentOverlay();
        const staticItems = flattenNavigationItems(base.navigation ?? []);
        const marketplaceItem = createMarketplaceNavigationItem(marketplace.url);
        const requestedId = typeof request.id === 'string' ? request.id.trim() : '';
        const prepared = prepareInstall(request, {
          allowThirdParty: marketplace.allowThirdParty,
          validation: createOverlayValidationContext({
            config: base,
            staticItems: [...staticItems, marketplaceItem],
          }),
          takenPaths: new Set([
            ...staticItems.map((item) => item.path),
            ...current.installedApps.map((app) => app.path),
            marketplaceItem.path,
          ]),
          existing: current.installedApps.find((app) => app.id === requestedId) ?? null,
        });
        if (!prepared.ok) return prepared;
        const accepted = await askConfirm(prepared.summary);
        if (!accepted) return { ok: false as const, error: 'confirmation_declined' };
        // The layout may have changed while the dialog was open.
        const latest = currentOverlay();
        const record = prepared.record;
        setPendingRemovals(
          withoutUndoneRemovals(pendingRemovalsRef.current, record.id, 'reinstall'),
        );
        const installedApps = upsertInstalledApp(latest.installedApps, record);
        const stored = installedApps.find((app) => app.id === record.id) ?? record;
        const next: NavigationOverlay = {
          ...latest,
          installedApps,
          order: latest.order.includes(stored.path) ? latest.order : [...latest.order, stored.path],
          updatedAt: record.updatedAt,
        };
        const saved = await persist(next);
        return saved.ok ? { ok: true as const, app: stored } : saved;
      } finally {
        installLockRef.current = false;
      }
    },
    [askConfirm, base, currentOverlay, customizationOn, marketplace, persist, setPendingRemovals],
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
        { id?: string; request?: MarketplaceInstallRequest } | undefined;
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
      customizationEnabled: customizationOn,
      installedApps: customizationOn ? (overlay?.installedApps ?? []) : [],
      listInstalledApps: () => overlayRef.current?.installedApps ?? [],
      uninstallApp,
      setAppCapabilities,
      moveNavigationItem,
      setNavigationItemHidden,
      resetNavigation,
      unsavedRemovals,
    }),
    [
      customizationOn,
      moveNavigationItem,
      overlay,
      resetNavigation,
      setAppCapabilities,
      setNavigationItemHidden,
      uninstallApp,
      unsavedRemovals,
    ],
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
