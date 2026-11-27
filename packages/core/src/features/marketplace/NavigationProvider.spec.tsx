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

/**
 * What identity-service would hold for this person. A write must send the current ETag in
 * If-Match once a document exists, or it gets a 412 without an ETag.
 */
const server = {
  overlay: null as null | Record<string, unknown>,
  version: 0,
  gate: null as null | Promise<void>,
  /** Refuse every write with 412, as if another device keeps saving first. */
  alwaysConflict: false,
  /** Every GET fails, as if identity were down. */
  getFails: false,
  /** Every write fails with 503, as if identity were down. */
  writeFails: false,
  /** Status for each next write, in order (412 or 503), before the rules above apply. */
  writeScript: [] as number[],
  /** While set, a GET sends its headers (with the ETag) at once and its body only later. */
  bodyGate: null as null | Promise<void>,
  /** One entry per next GET: when set, that GET waits for it before it answers at all. */
  getGates: [] as Array<Promise<void> | null>,
  calls: [] as string[],
};

function resetServer() {
  Object.assign(server, {
    overlay: null,
    version: 0,
    gate: null,
    alwaysConflict: false,
    getFails: false,
    writeFails: false,
    writeScript: [],
    bodyGate: null,
    getGates: [],
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
      const held = server.getGates.shift();
      if (held) await held;
      if (server.gate) await server.gate;
      if (server.getFails) return new Response(null, { status: 503 });
      if (!server.overlay) return new Response(null, { status: 404 });
      const body = structuredClone(server.overlay);
      const bodyGate = server.bodyGate;
      return {
        status: 200,
        ok: true,
        headers: new Headers(etag()),
        json: async () => {
          if (bodyGate) await bodyGate;
          return body;
        },
      } as unknown as Response;
    }
    // Like identity-service: a 412 carries the current ETag (none when there is no document).
    const conflict = () =>
      new Response(null, { status: 412, headers: server.overlay ? etag() : {} });
    const scripted = server.writeScript.shift();
    if (scripted === 412) return conflict();
    if (scripted !== undefined || server.writeFails) return new Response(null, { status: 503 });
    const stale = server.overlay !== null && headers['If-Match'] !== `"v${server.version}"`;
    if (server.alwaysConflict || stale) return conflict();
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
  sessionStorage.clear();
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

const OTHER = ['theme', 'locale', 'ui', 'storage', 'ai'];

/** Start edits together, so each is still waiting on its save when the next one starts. */
async function together(...edits: Array<() => Promise<Result>>): Promise<Result[]> {
  let pending!: Promise<Result[]>;
  await act(async () => {
    pending = Promise.all(edits.map((edit) => edit()));
  });
  await flush();
  return pending;
}

const serverApps = () =>
  ((server.overlay as { installedApps: Array<{ id: string }> } | null)?.installedApps ?? []).map(
    (app) => app.id,
  );

describe('NavigationProvider on a save conflict (412)', () => {
  it('keeps a revoke and the other device additions, and saves once more', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    const before = snapshots.length;
    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result.ok).toBe(true);
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(server.calls.slice(-3)).toEqual(['PUT', 'GET', 'PUT']);
    expect(toasts).toEqual([]);
    expect(snapshots.length).toBeGreaterThan(before);
    for (const snapshot of snapshots.slice(before))
      expect(snapshot.grants).not.toContain('storage');
  });

  it('keeps the removal in force and says so when the second save fails too', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);
    server.alwaysConflict = true;

    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(currentGrant()).not.toContain('storage');
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
  });

  it('keeps an uninstall applied on top of the newer layout', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    const result = await run(() => api.uninstallApp('notes'));

    expect(result.ok).toBe(true);
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(serverApps()).toEqual([]);
  });

  it('shows the newer layout for a change that is not a removal', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    const result = await run(() => api.setNavigationItemHidden('about', true));

    expect(result).toEqual({ ok: false, error: 'layout_conflict' });
    expect(hiddenPaths).not.toContain('about');
    expect(currentGrant()).toEqual(['ai', 'locale', 'storage', 'theme', 'ui']);
    expect(toasts).toEqual([en.marketplace.layoutConflict]);
  });

  it.each([
    ['hide', () => api.setNavigationItemHidden('about', true)],
    ['move', () => api.moveNavigationItem('about', 'up')],
    ['widen', () => api.setAppCapabilities('notes', ['ui', 'ai'])],
  ])('keeps a revoke when a %s edit is in flight with it', async (_name, second) => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    const [revoke] = await together(() => api.setAppCapabilities('notes', ['ui']), second);

    expect(revoke).toEqual({ ok: false, error: 'superseded' });
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'theme', 'ui']);
    for (const snapshot of snapshots) {
      if (snapshot.overlay.length)
        expect(snapshot.overlay.includes('storage')).toBe(snapshot.grants.includes('storage'));
    }
  });

  it('keeps a revoke when a widen starts while the newer layout is still loading', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);
    let release!: () => void;
    server.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let revoke!: Promise<Result>;
    await act(async () => {
      revoke = api.setAppCapabilities('notes', ['ui']);
    });
    let widen!: Promise<Result>;
    await act(async () => {
      widen = api.setAppCapabilities('notes', ['ui', 'ai']);
    });
    expect(currentGrant()).not.toContain('storage');
    await act(async () => release());
    await flush();

    expect(await revoke).toEqual({ ok: false, error: 'superseded' });
    await widen;
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'theme', 'ui']);
  });

  it('keeps an uninstall when a hide is in flight with it', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    await together(
      () => api.uninstallApp('notes'),
      () => api.setNavigationItemHidden('about', true),
    );

    expect(api.installedApps).toEqual([]);
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(serverApps()).toEqual([]);
  });

  it('does not overwrite a newer local edit while the newer layout is loading', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);
    let release!: () => void;
    server.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let revoke!: Promise<Result>;
    await act(async () => {
      revoke = api.setAppCapabilities('notes', ['ui']);
    });
    // The hide is a stale write too, so it also gets a 412 and waits for the newer layout.
    let hide!: Promise<Result>;
    await act(async () => {
      hide = api.setNavigationItemHidden('about', true);
    });
    await act(async () => release());
    await flush();

    expect(await revoke).toEqual({ ok: false, error: 'superseded' });
    expect(await hide).toEqual({ ok: false, error: 'layout_conflict' });
    expect(server.calls.filter((call) => call === 'PUT')).toHaveLength(4);
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
  });

  it('never falls back to the device copy when identity cannot be read after a conflict', async () => {
    await mountSignedInWithApp();
    const stale = structuredClone(server.overlay) as {
      installedApps: Array<Record<string, unknown>>;
    };
    stale.installedApps.push({
      ...stale.installedApps[0],
      id: 'old',
      name: 'App old',
      origin: 'https://old.example',
      url: 'https://old.example/',
      path: 'old',
      capabilities: ['theme', 'locale', 'ui', 'storage'],
    });
    localStorage.setItem(
      navigationLayoutStorageKey({ userId: 'u1', companyId: '1' }),
      JSON.stringify(stale),
    );
    otherDeviceSets(OTHER);
    server.getFails = true;

    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(api.installedApps.map((app) => app.id)).toEqual(['notes']);
    expect(shellui.frameRegistry.getCapabilityGrant('https://old.example')).toBeUndefined();
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
  });

  it('does not report a reset as done when the conflict persists', async () => {
    await mountSignedInWithApp();
    const key = navigationLayoutStorageKey({ userId: 'u1', companyId: '1' });
    localStorage.setItem(key, JSON.stringify({ kept: true }));
    otherDeviceSets(OTHER);
    server.alwaysConflict = true;

    const result = await run(() => api.resetNavigation());

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
    expect(server.overlay).not.toBeNull();
    expect(getInstalledAppRecords()).toHaveLength(0);
  });

  it('applies a reset again on the newer layout', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    const result = await run(() => api.resetNavigation());

    expect(result.ok).toBe(true);
    expect(server.overlay).toBeNull();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(toasts).toEqual([]);
  });
});

/** Unmount and mount again, as a page reload in the same tab does. */
async function reload() {
  act(() => root.unmount());
  root = createRoot(container);
  mount();
  await flush();
}

describe('NavigationProvider when identity cannot save', () => {
  it('keeps a revoke pending and says NOT saved when only the device copy was written', async () => {
    await mountSignedInWithApp();
    server.writeFails = true;

    const result = await run(() => api.setAppCapabilities('notes', ['ui']));

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(serverCapabilities()).toContain('storage');

    // Identity still has storage. A reload in this tab must not hand it back.
    await reload();
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);

    // The next save that reaches identity carries the revoke.
    server.writeFails = false;
    expect((await run(() => api.setNavigationItemHidden('about', true))).ok).toBe(true);
    expect(serverCapabilities()).toEqual(['locale', 'theme', 'ui']);
  });

  it('keeps a revoke refused twice in a row, across a reload, until a save reaches identity', async () => {
    await mountSignedInWithApp();
    server.writeFails = true;

    expect(await run(() => api.setAppCapabilities('notes', ['ui']))).toEqual({
      ok: false,
      error: 'not_saved',
    });
    expect(api.unsavedRemovals).toBe(true);
    expect(await run(() => api.setNavigationItemHidden('about', true))).toEqual({
      ok: false,
      error: 'not_saved',
    });
    expect(api.unsavedRemovals).toBe(true);
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);

    await reload();
    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    expect(api.unsavedRemovals).toBe(true);

    server.writeFails = false;
    expect((await run(() => api.moveNavigationItem('about', 'up'))).ok).toBe(true);
    expect(serverCapabilities()).toEqual(['locale', 'theme', 'ui']);
    expect(api.unsavedRemovals).toBe(false);
  });

  it.each([
    ['412 then 412', [412, 412]],
    ['412 then 503', [412, 503]],
  ])(
    'keeps a revoke refused %s, across a reload, until a save reaches identity',
    async (_name, statuses) => {
      await mountSignedInWithApp();
      server.writeScript = [...statuses];

      expect(await run(() => api.setAppCapabilities('notes', ['ui']))).toEqual({
        ok: false,
        error: 'not_saved',
      });
      expect(server.calls.slice(-3)).toEqual(['PUT', 'GET', 'PUT']);
      expect(server.writeScript).toEqual([]);
      expect(api.unsavedRemovals).toBe(true);
      expect(serverCapabilities()).toContain('storage');

      await reload();
      expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
      expect(api.unsavedRemovals).toBe(true);

      expect((await run(() => api.moveNavigationItem('about', 'up'))).ok).toBe(true);
      expect(serverCapabilities()).toEqual(['locale', 'theme', 'ui']);
      expect(api.unsavedRemovals).toBe(false);
    },
  );

  it('clears every pending removal once a reset succeeds', async () => {
    await mountSignedInWithApp();
    const withNotes = structuredClone(server.overlay);
    server.writeFails = true;
    await run(() => api.uninstallApp('notes'));
    expect((await run(() => api.resetNavigation())).ok).toBe(false);
    expect(api.unsavedRemovals).toBe(true);

    server.writeFails = false;
    expect((await run(() => api.resetNavigation())).ok).toBe(true);
    expect(api.unsavedRemovals).toBe(false);
    expect(Object.keys(sessionStorage)).toEqual([]);

    // Notes installed again elsewhere is not removed by a leftover entry in this tab.
    server.overlay = withNotes;
    server.version += 1;
    await reload();
    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
  });

  it('says NOT saved when identity cannot reset', async () => {
    await mountSignedInWithApp();
    server.writeFails = true;

    const result = await run(() => api.resetNavigation());

    expect(result).toEqual({ ok: false, error: 'not_saved' });
    expect(toasts).toEqual([en.marketplace.layoutNotSaved]);
    await reload();
    expect(api.installedApps).toEqual([]);
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
  });

  it('grants again after an unsaved revoke', async () => {
    await mountSignedInWithApp();
    server.writeFails = true;
    await run(() => api.setAppCapabilities('notes', ['ui']));
    server.writeFails = false;

    const result = await run(() => api.setAppCapabilities('notes', ['ui', 'storage']));

    expect(result.ok).toBe(true);
    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
    expect(serverCapabilities()).toEqual(['locale', 'storage', 'theme', 'ui']);
  });

  it('installs again after an unsaved uninstall', async () => {
    await mountSignedInWithApp();
    server.writeFails = true;
    await run(() => api.uninstallApp('notes'));
    server.writeFails = false;

    await requestInstall('notes', ['ui', 'storage']);
    await confirmInstall();

    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
    expect(serverApps()).toEqual(['notes']);
  });

  it('never applies one account pending removals to another account', async () => {
    await mountSignedInWithApp();
    const otherAccountLayout = structuredClone(server.overlay);
    server.writeFails = true;
    await run(() => api.setAppCapabilities('notes', ['ui']));

    // u2 signs in on the same tab. Its own layout has notes with storage.
    server.writeFails = false;
    server.overlay = otherAccountLayout;
    server.version += 1;
    page.session = { accessToken: 'token-u2', userId: 'u2' };
    mount();
    await flush();
    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);

    expect((await run(() => api.setNavigationItemHidden('about', true))).ok).toBe(true);
    expect(serverCapabilities()).toEqual(['locale', 'storage', 'theme', 'ui']);
  });
});

describe('NavigationProvider reset racing another edit', () => {
  it('keeps every app the reset removed', async () => {
    await mountSignedInWithApp();
    otherDeviceSets(OTHER);

    await together(
      () => api.resetNavigation(),
      () => api.setNavigationItemHidden('about', true),
    );

    expect(api.installedApps).toEqual([]);
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(serverApps()).toEqual([]);
  });
});

/** Another device saves a layout this device has not seen. */
function otherDeviceSaves(change: (layout: { hiddenPaths: string[] }) => void) {
  const layout = structuredClone(server.overlay) as {
    installedApps: Array<Record<string, unknown>>;
    hiddenPaths: string[];
  };
  layout.installedApps[0].capabilities = OTHER;
  change(layout);
  server.overlay = layout;
  server.version += 1;
}

function holdBodies() {
  let release!: () => void;
  server.bodyGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}

const serverHidden = () => (server.overlay as { hiddenPaths?: string[] } | null)?.hiddenPaths ?? [];

describe('NavigationProvider when a read body arrives after its headers', () => {
  it('a hide during the conflict read does not save over the other device', async () => {
    await mountSignedInWithApp();
    otherDeviceSaves(() => {});
    const release = holdBodies();
    let revoke!: Promise<Result>;
    await act(async () => {
      revoke = api.setAppCapabilities('notes', ['ui']);
    });
    server.bodyGate = null;
    let hide!: Promise<Result>;
    await act(async () => {
      hide = api.setNavigationItemHidden('about', true);
    });
    await act(async () => release());
    await flush();

    expect(await revoke).toEqual({ ok: false, error: 'superseded' });
    expect(await hide).toEqual({ ok: false, error: 'layout_conflict' });
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
  });

  it('refuses every change until the first read is committed, and writes nothing', async () => {
    await mountSignedInWithApp();
    otherDeviceSaves((layout) => {
      layout.hiddenPaths = ['about'];
    });
    const release = holdBodies();
    act(() => root.unmount());
    root = createRoot(container);
    mount();
    await flush();
    server.bodyGate = null;
    const calls = server.calls.length;

    expect(api.layoutReady).toBe(false);
    expect(await run(() => api.moveNavigationItem('about', 'up'))).toEqual({
      ok: false,
      error: 'layout_loading',
    });
    expect(await run(() => api.resetNavigation())).toEqual({ ok: false, error: 'layout_loading' });
    expect(server.calls.length).toBe(calls);

    await act(async () => release());
    await flush();
    expect(api.layoutReady).toBe(true);
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'storage', 'theme', 'ui']);
    expect(serverHidden()).toEqual(['about']);
    expect(currentGrant()).toEqual(['ai', 'locale', 'storage', 'theme', 'ui']);
  });

  it('a read dropped as stale adopts no version, so a later edit cannot overwrite', async () => {
    await mountSignedInWithApp();
    otherDeviceSaves(() => {});
    // The revoke's conflict read answers at once and is dropped (the hide is newer). The
    // hide's conflict read is held while a move is made.
    let release!: () => void;
    server.getGates = [
      null,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    ];
    const results: Array<Promise<Result>> = [];
    await act(async () => {
      results.push(api.setAppCapabilities('notes', ['ui']));
      results.push(api.setNavigationItemHidden('about', true));
    });
    await flush();
    await act(async () => {
      results.push(api.moveNavigationItem('about', 'up'));
    });
    await act(async () => release());
    await flush();

    const settled = await Promise.all(results);
    expect(settled.some((result) => result.ok)).toBe(false);
    expect(serverCapabilities()).toEqual(['ai', 'locale', 'theme', 'ui']);
    expect(currentGrant()).toEqual(['ai', 'locale', 'theme', 'ui']);
  });
});
