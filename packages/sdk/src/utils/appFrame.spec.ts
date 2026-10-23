import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';
import { MessageSecurityPolicy } from './messageSecurity.js';
import {
  CHILD_FRAME_REGISTER,
  CHILD_FRAME_SESSION,
  CHILD_FRAME_UNREGISTER,
  createAppFrameWith,
} from './appFrame.js';
import type { ShellUIMessage } from '../types.js';

type Listener = (message: ShellUIMessage, event: MessageEvent) => void;

function setup() {
  vi.stubGlobal('window', {
    location: { origin: 'https://dashboard.example.com', href: 'https://dashboard.example.com/' },
    parent: {},
  });
  vi.stubGlobal('HTMLIFrameElement', class {});
  const childWindow = {} as Window;
  const iframe = Object.assign(
    new (globalThis.HTMLIFrameElement as unknown as new () => object)(),
    {
      tagName: 'IFRAME',
      src: '',
      contentWindow: childWindow,
    },
  ) as unknown as HTMLIFrameElement;
  const listeners = new Map<string, Listener[]>();
  const sent: ShellUIMessage[] = [];
  const host = {
    frameRegistry: new FrameRegistry(),
    messageSecurity: new MessageSecurityPolicy(),
    addMessageListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      return () =>
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((l) => l !== listener),
        );
    },
    sendMessageToParent(message: ShellUIMessage) {
      sent.push(message);
      return true;
    },
  };
  const emit = (type: string, payload: unknown, source: unknown, origin: string) =>
    (listeners.get(type) ?? []).forEach((l) =>
      l({ type, payload } as ShellUIMessage, { source, origin } as MessageEvent),
    );
  return { iframe, childWindow, host, sent, emit, listeners };
}

afterEach(() => vi.unstubAllGlobals());

describe('createAppFrameWith', () => {
  it('rejects non-http URLs', () => {
    const { iframe, host } = setup();
    expect(() => createAppFrameWith(host, iframe, { url: 'javascript:alert(1)' })).toThrow();
    expect(() =>
      createAppFrameWith(host, iframe, {
        url: 'https://admin.example.com/',
        backend: { url: 'data:text/plain,x' },
      }),
    ).toThrow();
  });

  it('trusts only the exact child origin and registers with the shell', () => {
    const { iframe, host, sent } = setup();
    const handle = createAppFrameWith(host, iframe, {
      url: 'https://admin.example.com/users?x=1',
      backend: { url: 'https://id.eu.example.com', companyId: 'abc' },
    });
    expect(handle.origin).toBe('https://admin.example.com');
    expect(host.messageSecurity.isOriginAllowed('https://admin.example.com')).toBe(true);
    expect(host.messageSecurity.isOriginAllowed('https://evil.example.com')).toBe(false);
    expect(sent[0]).toEqual({
      type: CHILD_FRAME_REGISTER,
      payload: {
        frameId: handle.frameId,
        url: 'https://admin.example.com/users?x=1',
        backend: { url: 'https://id.eu.example.com', companyId: 'abc' },
      },
    });
    handle.destroy();
    expect(host.messageSecurity.isOriginAllowed('https://admin.example.com')).toBe(false);
    expect(host.frameRegistry.getAllIframes()).toHaveLength(0);
    expect(sent[1]).toEqual({ type: CHILD_FRAME_UNREGISTER, payload: { frameId: handle.frameId } });
  });

  it('relays navigation and ready only from the child window and origin', () => {
    const { iframe, childWindow, host, emit } = setup();
    const onNavigate = vi.fn();
    const onReady = vi.fn();
    const handle = createAppFrameWith(host, iframe, {
      url: 'https://admin.example.com/',
      onNavigate,
      onReady,
    });
    const loc = { pathname: '/users', search: '', hash: '', fullPath: '/users' };
    emit('SHELLUI_URL_CHANGED', loc, {}, 'https://admin.example.com');
    emit('SHELLUI_URL_CHANGED', loc, childWindow, 'https://evil.example.com');
    emit('SHELLUI_INITIALIZED', {}, {}, 'https://admin.example.com');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    emit('SHELLUI_URL_CHANGED', loc, childWindow, 'https://admin.example.com');
    emit('SHELLUI_INITIALIZED', {}, childWindow, 'https://admin.example.com');
    expect(onNavigate).toHaveBeenCalledWith(loc);
    expect(onReady).toHaveBeenCalledTimes(1);
    handle.destroy();
    emit('SHELLUI_INITIALIZED', {}, childWindow, 'https://admin.example.com');
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('MessageSecurityPolicy.allowFrameOrigin', () => {
  it('needs an exact origin and survives configure()', () => {
    const policy = new MessageSecurityPolicy();
    vi.stubGlobal('window', { location: { origin: 'https://a.example.com' }, parent: undefined });
    expect(() => policy.allowFrameOrigin('*')).toThrow();
    expect(() => policy.allowFrameOrigin('https://b.example.com/path')).toThrow();
    const release = policy.allowFrameOrigin('https://b.example.com');
    policy.configure({ allowedOrigins: [] });
    expect(policy.isOriginAllowed('https://b.example.com')).toBe(true);
    release();
    expect(policy.isOriginAllowed('https://b.example.com')).toBe(false);
  });

  it('reports the shell session result for its own frame only', () => {
    const { iframe, host, emit } = setup();
    const onSession = vi.fn();
    const handle = createAppFrameWith(host, iframe, {
      url: 'https://admin.example.com/',
      onSession,
    });
    const parent = (globalThis.window as unknown as { parent: unknown }).parent;
    emit(CHILD_FRAME_SESSION, { frameId: 'other', ok: false, reason: 'x' }, parent, 'https://s');
    emit(CHILD_FRAME_SESSION, { frameId: handle.frameId, ok: false, reason: 'x' }, {}, 'https://s');
    expect(onSession).not.toHaveBeenCalled();
    emit(
      CHILD_FRAME_SESSION,
      { frameId: handle.frameId, ok: false, reason: 'timeout', hint: 'h' },
      parent,
      'https://s',
    );
    expect(onSession).toHaveBeenCalledWith({ ok: false, reason: 'timeout', hint: 'h' });
  });
});
