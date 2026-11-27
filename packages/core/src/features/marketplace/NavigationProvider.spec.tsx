// @vitest-environment happy-dom
import { StrictMode, act, createElement, startTransition, useContext, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MARKETPLACE_INSTALL,
  MARKETPLACE_INSTALL_RESULT,
  shellui,
  type ShellUIMessage,
} from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import { ConfigContext } from '../config/ConfigProvider';
import {
  NavigationProvider,
  useNavigation,
  type NavigationContextValue,
} from './NavigationProvider';
import { clearInstalledAppRecords, getInstalledAppRecords } from './installedAppRegistry';
import { navigationLayoutStorageKey } from './storage';
import en from '../../i18n/translations/en/common.json';
import fr from '../../i18n/translations/fr/common.json';

const MARKETPLACE = 'https://marketplace.example';
const APP_ORIGIN = 'https://notes.example';

const page = vi.hoisted(() => ({
  config: {} as unknown as ShellUIConfig,
  session: null as null | { accessToken: string; userId: string },
}));
const dialog = vi.hoisted(() => ({
  props: null as null | { summary: unknown; onConfirm: () => void; onCancel: () => void },
}));

vi.mock('../config/useConfig', () => ({
  useConfig: () => ({ loading: false, config: page.config }),
}));
vi.mock('../auth/hooks/useAuth', () => ({ useAuth: () => ({ session: page.session }) }));
vi.mock('./InstallConfirmDialog', () => ({
  InstallConfirmDialog: (props: NonNullable<typeof dialog.props>) => {
    dialog.props = props;
    return null;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

void i18n.init({ lng: 'en', defaultNS: 'common', resources: { en: { common: en } } });

function makeConfig(storage: 'localStorage' | 'api'): ShellUIConfig {
  return {
    title: 'Shell',
    navigation: [
      { label: 'Home', path: '', url: 'https://home.example/' },
      { label: 'About', path: 'about', url: 'https://about.example/' },
    ],
    backend: { type: 'shellui', url: 'https://id.example', companyId: 1 },
    marketplace: {
      url: MARKETPLACE,
      apiUrl: 'https://api.marketplace.example',
      allowThirdParty: true,
      navigationCustomization: { enabled: true, storage },
    },
  } as unknown as ShellUIConfig;
}

type Snapshot = { overlay: string[]; grants: string[]; records: string[] };
type Result = { ok: boolean; error?: string };

const handlers = new Map<string, (message: ShellUIMessage, event: MessageEvent) => void>();
const replies: Array<{ type: string; payload: Record<string, unknown> }> = [];
const snapshots: Snapshot[] = [];
const toasts: string[] = [];
const renderWrites: string[] = [];
let api: NavigationContextValue;
let hiddenPaths: string[] = [];
let root: Root;
let container: HTMLElement;

/** What the identity service would hold for this person, with the ETag rules the shell relies on. */
const server = {
  overlay: null as null | Record<string, unknown>,
  version: 0,
  gate: null as null | Promise<void>,
  /** Refuse every write with 412, as if another device keeps saving first. */
  alwaysConflict: false,
  /** Accept a write whatever its If-Match says. */
  acceptStale: false,
  calls: [] as string[],
};

function resetServer() {
  Object.assign(server, {
    overlay: null,
    version: 0,
    gate: null,
    alwaysConflict: false,
    acceptStale: false,
    calls: [],
  });
}

function installFakeServer() {
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    server.calls.push(method);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const etag = () => ({ ETag: `"v${server.version}"` });
    if (method === 'GET') {
      if (server.gate) await server.gate;
      if (!server.overlay) return new Response(null, { status: 404 });
      return new Response(JSON.stringify(server.overlay), { status: 200, headers: etag() });
    }
    const stale = server.overlay !== null && headers['If-Match'] !== `"v${server.version}"`;
    if (server.alwaysConflict || (stale && !server.acceptStale)) {
      return new Response(null, { status: 412, headers: etag() });
    }
    server.version += 1;
    server.overlay = method === 'PUT' ? JSON.parse(String(init?.body)) : null;
    return new Response(null, { status: 204, headers: etag() });
  });
}

/** Another device saves a change to the app's capabilities that this device has not seen. */
function otherDeviceSets(capabilities: string[]) {
  const overlay = structuredClone(server.overlay) as {
    installedApps: Array<Record<string, unknown>>;
  };
  overlay.installedApps[0].capabilities = capabilities;
  server.overlay = overlay;
  server.version += 1;
}

const serverCapabilities = () =>
  [
    ...((server.overlay as { installedApps: Array<{ capabilities: string[] }> } | null)
      ?.installedApps[0]?.capabilities ?? []),
  ].sort();

/** Records, at every commit that changes the overlay, what the overlay and the policy say. */
function Probe() {
  const navigation = useNavigation();
  const shellConfig = useContext(ConfigContext);
  api = navigation;
  hiddenPaths = (shellConfig?.config.navigation ?? [])
    .filter((item) => 'hidden' in item && item.hidden === true)
    .map((item) => ('path' in item ? item.path : ''));
  // A passive effect runs after every layout effect of the same commit, the provider's included.
  useEffect(() => {
    const app = navigation.installedApps[0];
    const grant = shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN);
    snapshots.push({
      overlay: app ? [...app.capabilities].sort() : [],
      grants: grant ? [...grant.capabilities].sort() : [],
      records: getInstalledAppRecords().flatMap((record) => [...record.capabilities].sort()),
    });
  }, [navigation.installedApps]);
  return null;
}

function mount(strict = false) {
  const tree = createElement(NavigationProvider, null, createElement(Probe));
  act(() => root.render(strict ? createElement(StrictMode, null, tree) : tree));
}

const flush = () => act(async () => {});

async function requestInstall(id: string, capabilities: string[]) {
  const message = {
    type: MARKETPLACE_INSTALL,
    payload: {
      id: `req-${id}`,
      request: { id, name: `App ${id}`, url: `${APP_ORIGIN}/`, path: id, capabilities },
    },
  } as unknown as ShellUIMessage;
  await act(async () => {
    handlers.get(MARKETPLACE_INSTALL)?.(message, { origin: MARKETPLACE } as MessageEvent);
  });
}

async function confirmInstall() {
  await act(async () => dialog.props?.onConfirm());
  await flush();
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  let result!: T;
  await act(async () => {
    result = await fn();
  });
  return result;
}

const installResults = () => replies.filter((entry) => entry.type === MARKETPLACE_INSTALL_RESULT);

function currentGrant() {
  return [...(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)?.capabilities ?? [])].sort();
}

/** Signed in, layout stored in identity, one installed app with `ui` and `storage`. */
async function mountSignedInWithApp() {
  page.config = makeConfig('api');
  page.session = { accessToken: 'token', userId: 'u1' };
  installFakeServer();
  mount();
  await flush();
  await requestInstall('notes', ['ui', 'storage']);
  await confirmInstall();
  expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
  expect(serverCapabilities()).toEqual(['locale', 'storage', 'theme', 'ui']);
}

/** Fails a test if the registry or the message policy is written while React renders. */
function watchRenderWrites() {
  const guard = (original: (...args: never[]) => unknown, name: string) =>
    function (this: unknown, ...args: never[]) {
      if (/renderWithHooks|performUnitOfWork|beginWork/.test(new Error().stack ?? '')) {
        renderWrites.push(name);
      }
      return original.apply(this, args);
    };
  const registry = shellui.frameRegistry;
  const grants = registry.setCapabilityGrants.bind(registry);
  vi.spyOn(registry, 'setCapabilityGrants').mockImplementation(
    guard(grants as never, 'setCapabilityGrants') as never,
  );
  const security = shellui.configureMessageSecurity.bind(shellui);
  vi.spyOn(shellui, 'configureMessageSecurity').mockImplementation(
    guard(security as never, 'configureMessageSecurity') as never,
  );
}

beforeEach(() => {
  handlers.clear();
  replies.length = 0;
  snapshots.length = 0;
  toasts.length = 0;
  renderWrites.length = 0;
  dialog.props = null;
  page.config = makeConfig('localStorage');
  page.session = null;
  resetServer();
  localStorage.clear();
  vi.spyOn(shellui, 'addMessageListener').mockImplementation(((type: string, handler: never) => {
    handlers.set(type, handler);
    return () => handlers.delete(type);
  }) as never);
  vi.spyOn(shellui, 'sendMessage').mockImplementation(((message: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    replies.push({ type: message.type, payload: message.payload });
  }) as never);
  vi.spyOn(shellui, 'toast').mockImplementation(((options?: { title?: string }) => {
    toasts.push(String(options?.title ?? ''));
  }) as never);
  watchRenderWrites();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearInstalledAppRecords();
  shellui.frameRegistry.setCapabilityGrants([]);
  shellui.configureMessageSecurity({ allowedOrigins: [], marketplaceOrigin: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Nothing in a test may write the registry or the policy while React renders.
  expect(renderWrites).toEqual([]);
});

describe('NavigationProvider', () => {
  it('updates grants, registry and message policy in the same commit as a revoke', async () => {
    mount();
    await flush();
    await requestInstall('notes', ['ui', 'storage']);
    await confirmInstall();
    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
    expect(shellui.messageSecurity.isOriginAllowed(APP_ORIGIN)).toBe(true);

    await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(snapshots[snapshots.length - 1]).toEqual({
      overlay: ['locale', 'theme', 'ui'],
      grants: ['locale', 'theme', 'ui'],
      records: ['locale', 'theme', 'ui'],
    });

    await run(() => api.uninstallApp('notes'));
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(shellui.messageSecurity.isOriginAllowed(APP_ORIGIN)).toBe(false);
  });

  it('keeps one consistent registry under StrictMode', async () => {
    mount(true);
    await flush();
    await requestInstall('notes', ['ui']);
    await confirmInstall();
    await run(() => api.setAppCapabilities('notes', []));
    expect(getInstalledAppRecords()).toHaveLength(1);
    expect(currentGrant()).toEqual(['locale', 'theme']);
    expect(api.installedApps).toHaveLength(1);
    for (const snapshot of snapshots) {
      expect(
        snapshot.grants.length === 0 || snapshot.grants.join() === snapshot.overlay.join(),
      ).toBe(true);
    }
  });

  it('refuses a second install while the confirmation is open', async () => {
    mount();
    await flush();
    await requestInstall('notes', ['ui']);
    const pending = dialog.props?.summary;
    expect(pending).toMatchObject({ origin: APP_ORIGIN });

    await requestInstall('other', ['storage']);
    expect(installResults()).toEqual([
      {
        type: MARKETPLACE_INSTALL_RESULT,
        payload: { id: 'req-other', ok: false, error: 'install_in_progress' },
      },
    ]);
    expect(dialog.props?.summary).toBe(pending);
    expect(getInstalledAppRecords()).toHaveLength(0);

    await confirmInstall();
    expect(installResults()[1].payload).toMatchObject({ id: 'req-notes', ok: true });
    expect(api.installedApps.map((app) => app.id)).toEqual(['notes']);
  });

  it('applies the message policy at mount, before the saved layout has loaded', async () => {
    page.config = makeConfig('api');
    page.session = { accessToken: 'token', userId: 'u1' };
    installFakeServer();
    server.gate = new Promise(() => {});
    mount();
    // The layout request never answers. Only the layout effect can have applied the policy.
    expect(shellui.messageSecurity.isOriginAllowed(MARKETPLACE)).toBe(true);
  });

  it('pulls the policy back to the committed layout when a pending transition wrote ahead', async () => {
    mount();
    await flush();
    await requestInstall('notes', ['ui', 'storage']);
    await confirmInstall();

    await act(async () => {
      // An urgent revoke commits first. The widening update is still pending in a transition
      // and has already written its grants. The commit must bring them back to the revoke.
      void api.setAppCapabilities('notes', ['ui']);
      startTransition(() => {
        void api.setAppCapabilities('notes', ['ui', 'storage', 'ai']);
      });
    });
    await flush();

    const allowed = new Set(['theme', 'locale']);
    expect(snapshots.length).toBeGreaterThan(2);
    for (const snapshot of snapshots) {
      for (const capability of [...snapshot.grants, ...snapshot.records]) {
        expect(snapshot.overlay.includes(capability) || allowed.has(capability)).toBe(true);
      }
    }
    expect(currentGrant()).toEqual([...(api.installedApps[0]?.capabilities ?? [])].sort());
  });
});

describe('conflict messages', () => {
  it('exist in English and French', () => {
    for (const messages of [en, fr]) {
      expect(messages.marketplace.layoutConflict).toBeTruthy();
      expect(messages.marketplace.layoutNotSaved).toBeTruthy();
    }
    expect(fr.marketplace.layoutNotSaved).not.toBe(en.marketplace.layoutNotSaved);
  });
});

describe('NavigationProvider on a save conflict (412)', () => {
  it('keeps a revoke applied on top of the newer layout and saves it again', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);

    const before = snapshots.length;
    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result.ok).toBe(true);
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(serverCapabilities()).toEqual(['locale', 'theme', 'ui']);
    expect(server.calls.slice(-3)).toEqual(['PUT', 'GET', 'PUT']);
    expect(toasts).toEqual([]);
    expect(snapshots.length).toBeGreaterThan(before);
    for (const snapshot of snapshots.slice(before)) {
      expect(snapshot.grants).not.toContain('storage');
      expect(snapshot.grants).not.toContain('ai');
    }
  });

  it('keeps the removal in force and says so when the second save fails too', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);
    server.alwaysConflict = true;

    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(currentGrant()).not.toContain('storage');
    expect(currentGrant()).not.toContain('ai');
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
  });

  it('keeps an uninstall applied on top of the newer layout', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);

    const result = await run(() => api.uninstallApp('notes'));

    expect(result.ok).toBe(true);
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect((server.overlay as { installedApps: unknown[] }).installedApps).toEqual([]);
  });

  it('shows the newer layout for a change that is not a removal', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);

    const result = await run(() => api.setNavigationItemHidden('about', true));

    expect(result).toEqual({ ok: false, error: 'layout_conflict' });
    expect(hiddenPaths).not.toContain('about');
    expect(currentGrant()).toEqual(['ai', 'locale', 'storage', 'theme', 'ui']);
    expect(toasts).toEqual([en.marketplace.layoutConflict]);
  });

  it('does not overwrite a newer local edit while the newer layout is loading', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);
    let release!: () => void;
    server.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let revoke!: Promise<Result>;
    await act(async () => {
      revoke = api.setAppCapabilities('notes', ['ui']);
    });
    // The revoke is waiting for the newer layout. A newer local edit saves meanwhile.
    server.acceptStale = true;
    await run(() => api.setNavigationItemHidden('about', true));
    await act(async () => release());
    const result = await revoke;

    expect(result).toEqual({ ok: false, error: 'layout_conflict' });
    expect(hiddenPaths).toContain('about');
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
  });

  it('does not report a reset as done when the conflict persists', async () => {
    await mountSignedInWithApp();
    const key = navigationLayoutStorageKey({ userId: 'u1', companyId: '1' });
    localStorage.setItem(key, JSON.stringify({ kept: true }));
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);
    server.alwaysConflict = true;

    const result = await run(() => api.resetNavigation());

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
    expect(server.overlay).not.toBeNull();
  });

  it('applies a reset again on the newer layout', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(['theme', 'locale', 'ui', 'storage', 'ai']);

    const result = await run(() => api.resetNavigation());

    expect(result.ok).toBe(true);
    expect(server.overlay).toBeNull();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(toasts).toEqual([]);
  });
});
