// @vitest-environment happy-dom
import { StrictMode, act, createElement, startTransition, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MARKETPLACE_INSTALL,
  MARKETPLACE_INSTALL_RESULT,
  shellui,
  type ShellUIMessage,
} from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import {
  NavigationProvider,
  useNavigation,
  type NavigationContextValue,
} from './NavigationProvider';
import { clearInstalledAppRecords, getInstalledAppRecords } from './installedAppRegistry';

const MARKETPLACE = 'https://marketplace.example';
const APP_ORIGIN = 'https://notes.example';

const page = vi.hoisted(() => ({
  config: {
    title: 'Shell',
    navigation: [{ label: 'Home', path: '', url: 'https://home.example/' }],
    marketplace: {
      url: 'https://marketplace.example',
      apiUrl: 'https://api.marketplace.example',
      allowThirdParty: true,
      navigationCustomization: { enabled: true, storage: 'localStorage' },
    },
  } as unknown as ShellUIConfig,
}));
const dialog = vi.hoisted(() => ({
  props: null as null | { summary: unknown; onConfirm: () => void; onCancel: () => void },
}));

vi.mock('../config/useConfig', () => ({
  useConfig: () => ({ loading: false, config: page.config }),
}));
vi.mock('../auth/hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('./InstallConfirmDialog', () => ({
  InstallConfirmDialog: (props: NonNullable<typeof dialog.props>) => {
    dialog.props = props;
    return null;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Snapshot = { overlay: string[]; grants: string[]; records: string[] };

const handlers = new Map<string, (message: ShellUIMessage, event: MessageEvent) => void>();
const replies: Array<{ type: string; payload: Record<string, unknown> }> = [];
const snapshots: Snapshot[] = [];
let api: NavigationContextValue;
let root: Root;
let container: HTMLElement;

/** Records, at every commit that changes the overlay, what the overlay and the policy say. */
function Probe() {
  const navigation = useNavigation();
  api = navigation;
  useLayoutEffect(() => {
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

function installResults() {
  return replies.filter((entry) => entry.type === MARKETPLACE_INSTALL_RESULT);
}

function currentGrant() {
  return [...(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)?.capabilities ?? [])].sort();
}

beforeEach(() => {
  handlers.clear();
  replies.length = 0;
  snapshots.length = 0;
  dialog.props = null;
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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearInstalledAppRecords();
  shellui.frameRegistry.setCapabilityGrants([]);
  vi.restoreAllMocks();
});

describe('NavigationProvider', () => {
  it('updates grants, registry and message policy in the same commit as a revoke', async () => {
    mount();
    await flush();
    await requestInstall('notes', ['ui', 'storage']);
    await confirmInstall();
    expect(currentGrant()).toEqual(['locale', 'storage', 'theme', 'ui']);
    expect(shellui.messageSecurity.isOriginAllowed(APP_ORIGIN)).toBe(true);

    await act(async () => {
      await api.setAppCapabilities('notes', ['ui']);
    });

    expect(currentGrant()).toEqual(['locale', 'theme', 'ui']);
    const last = snapshots[snapshots.length - 1];
    expect(last).toEqual({
      overlay: ['locale', 'theme', 'ui'],
      grants: ['locale', 'theme', 'ui'],
      records: ['locale', 'theme', 'ui'],
    });

    await act(async () => {
      await api.uninstallApp('notes');
    });
    expect(shellui.frameRegistry.getCapabilityGrant(APP_ORIGIN)).toBeUndefined();
    expect(getInstalledAppRecords()).toHaveLength(0);
    expect(shellui.messageSecurity.isOriginAllowed(APP_ORIGIN)).toBe(false);
  });

  it('keeps one consistent registry under StrictMode', async () => {
    mount(true);
    await flush();
    await requestInstall('notes', ['ui']);
    await confirmInstall();
    await act(async () => {
      await api.setAppCapabilities('notes', []);
    });
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

  it('never leaves grants looser than the committed overlay, even for transitions', async () => {
    mount();
    await flush();
    await requestInstall('notes', ['ui', 'storage', 'ai']);
    await confirmInstall();

    await act(async () => {
      startTransition(() => {
        void api.setAppCapabilities('notes', ['ui']);
      });
    });
    await flush();
    await act(async () => {
      startTransition(() => {
        void api.setAppCapabilities('notes', ['ui', 'storage']);
      });
    });
    await flush();

    const allowed = new Set(['theme', 'locale']);
    for (const snapshot of snapshots) {
      for (const capability of snapshot.grants) {
        expect(snapshot.overlay.includes(capability) || allowed.has(capability)).toBe(true);
      }
      for (const capability of snapshot.records) {
        expect(snapshot.overlay.includes(capability) || allowed.has(capability)).toBe(true);
      }
    }
    expect(currentGrant()).toEqual([...(api.installedApps[0]?.capabilities ?? [])].sort());
  });
});
