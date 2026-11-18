// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shellui, type ShellUIMessage } from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import type { ResolvedAppBackend } from '../auth/appBackend/identity';
import {
  addChildFrame,
  clearChildFrames,
  validateChildFrameRegistration,
} from '../auth/appBackend/childFrames';
import { StorageBridge } from './StorageBridge';

const REGIONAL_STORAGE = 'https://storage.eu.example.com';
const SHELL_STORAGE = 'https://storage.shell.example';
const REGIONAL_TOKEN = 'regional-token';
const SHELL_TOKEN = 'shell-token';

const page = vi.hoisted(() => ({
  includeShellStorage: false,
  accessToken: 'shell-token' as string | null,
}));

const ensure = vi.hoisted(() =>
  vi.fn(
    async (_identity: ResolvedAppBackend, _options?: { allowSilent?: boolean }) =>
      'regional-token' as string | null,
  ),
);

vi.mock('../config/useConfig', () => ({
  useConfig: () => ({
    loading: false,
    config: {
      navigation: [
        {
          label: 'Dashboard',
          path: '',
          url: 'https://dashboard.example.com/',
          safeForAuthToken: true,
          childFrames: {
            origins: ['https://admin.example.com'],
            backendOrigins: ['https://id.eu.example.com'],
            serviceOrigins: ['https://storage.eu.example.com', 'https://files.example.com'],
          },
        },
        {
          label: 'Companion',
          path: 'companion',
          url: 'https://companion.example.com/',
          safeForAuthToken: true,
        },
      ],
      ...(page.includeShellStorage ? { storage: { url: 'https://storage.shell.example' } } : {}),
    },
  }),
}));

vi.mock('../auth/hooks/useAuth', () => ({
  useAuth: () => ({
    session: page.accessToken ? { accessToken: page.accessToken } : null,
  }),
}));

vi.mock('../auth/appBackend/appBackendSessions', () => ({
  ensureAppBackendSession: (identity: ResolvedAppBackend, options?: { allowSilent?: boolean }) =>
    ensure(identity, options),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type StorageReply = {
  id: string;
  data?: unknown;
  error?: { message: string; status: number };
};

function shellConfig(): ShellUIConfig {
  return {
    navigation: [
      {
        label: 'Dashboard',
        path: '',
        url: 'https://dashboard.example.com/',
        safeForAuthToken: true,
        childFrames: {
          origins: ['https://admin.example.com'],
          backendOrigins: ['https://id.eu.example.com'],
          serviceOrigins: [REGIONAL_STORAGE, 'https://files.example.com'],
        },
      },
    ],
    ...(page.includeShellStorage ? { storage: { url: SHELL_STORAGE } } : {}),
  };
}

describe('StorageBridge storage target', () => {
  const frames: string[] = [];
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let listener: ((message: ShellUIMessage, event: MessageEvent) => void) | null = null;
  const sent: ShellUIMessage[] = [];
  const fetchMock = vi.fn();

  function addFrame(src: string): string {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    const uuid = shellui.frameRegistry.addIframe(iframe);
    frames.push(uuid);
    return uuid;
  }

  function registerFiles(hostUuid: string, storage: string) {
    const result = validateChildFrameRegistration({
      from: [hostUuid],
      hostSrc: 'https://dashboard.example.com/',
      payload: {
        frameId: 'files-1',
        url: 'https://admin.example.com/',
        backend: {
          url: 'https://id.eu.example.com',
          companyId: 'r1',
          provider: 'upstream',
        },
        services: {
          storage,
          files: 'https://files.example.com',
        },
      },
      config: shellConfig(),
    });
    if (!result.ok) throw new Error(result.reason);
    addChildFrame(result.entry);
  }

  function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(createElement(StorageBridge));
    });
    if (!listener) throw new Error('StorageBridge did not listen for storage requests');
  }

  async function request(from: string[], id: string): Promise<StorageReply> {
    listener?.(
      {
        type: 'SHELLUI_STORAGE_REQUEST',
        payload: { id, op: 'listBuckets' },
        from,
      },
      new MessageEvent('message'),
    );
    let reply: StorageReply | undefined;
    await vi.waitFor(() => {
      reply = sent.find((message) => (message.payload as StorageReply | undefined)?.id === id)
        ?.payload as StorageReply | undefined;
      expect(reply).toBeTruthy();
    });
    if (!reply) throw new Error(`no storage reply for ${id}`);
    return reply;
  }

  function expectStorageCall(url: string, token: string) {
    const match = fetchMock.mock.calls.find((call) => call[0] === `${url}/storage/v1/bucket`);
    expect(match).toBeTruthy();
    const init = (match?.[1] ?? {}) as RequestInit;
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`);
  }

  beforeEach(() => {
    page.includeShellStorage = false;
    page.accessToken = SHELL_TOKEN;
    ensure.mockReset();
    ensure.mockResolvedValue(REGIONAL_TOKEN);
    listener = null;
    sent.length = 0;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => [{ name: 'company' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    const add = shellui.addMessageListener.bind(shellui);
    vi.spyOn(shellui, 'addMessageListener').mockImplementation((type, cb) => {
      if (type === 'SHELLUI_STORAGE_REQUEST') listener = cb;
      return add(type, cb);
    });
    vi.spyOn(shellui, 'sendMessage').mockImplementation((message) => {
      sent.push(message);
      return 1;
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = null;
    container = null;
    for (const uuid of frames) shellui.frameRegistry.removeIframe(uuid);
    frames.length = 0;
    clearChildFrames();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the storage URL and regional session registered for a nested admin frame', async () => {
    mount();
    const host = addFrame('https://dashboard.example.com/');
    registerFiles(host, REGIONAL_STORAGE);

    const reply = await request([host, 'files-1'], 'nested-1');

    expect(reply).toEqual({ id: 'nested-1', data: [{ name: 'company' }] });
    expectStorageCall(REGIONAL_STORAGE, REGIONAL_TOKEN);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes(SHELL_STORAGE))).toBe(
      false,
    );
    expect(ensure).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://id.eu.example.com', companyId: 'r1' }),
      { allowSilent: true },
    );
  });

  it('keeps shellui.config storage for a frame the shell hosts directly', async () => {
    page.includeShellStorage = true;
    mount();
    const companion = addFrame('https://companion.example.com/files');

    const reply = await request([companion], 'direct-1');

    expect(reply).toEqual({ id: 'direct-1', data: [{ name: 'company' }] });
    expectStorageCall(SHELL_STORAGE, SHELL_TOKEN);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('does not use the shell storage URL when the nested frame has no allowed storage URL', async () => {
    page.includeShellStorage = true;
    mount();
    const host = addFrame('https://dashboard.example.com/');
    registerFiles(host, 'https://evil.example.org');

    const reply = await request([host, 'files-1'], 'rejected-1');

    expect(reply).toEqual({
      id: 'rejected-1',
      error: { message: 'Storage is not configured', status: 503 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a storage request from a frame the shell did not register', async () => {
    page.includeShellStorage = true;
    mount();

    const reply = await request(['not-a-frame'], 'untrusted-1');

    expect(reply.error).toEqual({
      message: 'Storage request rejected: untrusted frame',
      status: 403,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });

  it('does not apply one registered child storage URL to a different frame id', async () => {
    mount();
    const host = addFrame('https://dashboard.example.com/');
    registerFiles(host, REGIONAL_STORAGE);

    const reply = await request([host, 'other-files'], 'other-1');

    expect(reply).toEqual({
      id: 'other-1',
      error: { message: 'Storage is not configured', status: 503 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });
});
