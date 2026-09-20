import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';
import { MessageListenerRegistry } from './messageListenerRegistry.js';
import { MessageSecurityPolicy } from './messageSecurity.js';

class FakeIFrameElement {
  src = '';
  contentWindow: { postMessage: ReturnType<typeof vi.fn>; location: { origin: string } } | null =
    null;
}

beforeAll(() => {
  vi.stubGlobal('HTMLIFrameElement', FakeIFrameElement);
});

describe('MessageListenerRegistry live-frame send gate', () => {
  let registry: FrameRegistry;
  let listeners: MessageListenerRegistry;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new FrameRegistry();
    listeners = new MessageListenerRegistry(registry, new MessageSecurityPolicy());
    postMessage = vi.fn();

    const shellWindow = {
      location: { origin: 'http://localhost:4000' },
      parent: null as unknown as Window,
    } as Window;
    (shellWindow as { parent: Window }).parent = shellWindow;
    vi.stubGlobal('window', shellWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLIFrameElement', FakeIFrameElement);
  });

  it('does not postMessage to frames that have not started handshake', () => {
    const iframe = new FakeIFrameElement() as unknown as HTMLIFrameElement;
    iframe.src = 'http://localhost:5173/#/';
    (iframe as unknown as FakeIFrameElement).contentWindow = {
      postMessage,
      location: { origin: 'http://localhost:5173' },
    };
    const uuid = registry.addIframe(iframe);

    const sent = listeners.sendMessage({
      type: 'SHELLUI_LAYOUT_CHROME',
      payload: { layoutChrome: {} },
      to: [uuid],
    });

    expect(sent).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('posts to live frames after markLive', () => {
    const iframe = new FakeIFrameElement() as unknown as HTMLIFrameElement;
    iframe.src = 'http://localhost:5173/#/';
    (iframe as unknown as FakeIFrameElement).contentWindow = {
      postMessage,
      location: { origin: 'http://localhost:5173' },
    };
    const uuid = registry.addIframe(iframe);
    registry.markLive(uuid);

    const sent = listeners.sendMessage({
      type: 'SHELLUI_SETTINGS',
      payload: { settings: {} },
      to: [uuid],
    });

    expect(sent).toBe(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][1]).toBe('http://localhost:5173');
  });
});
