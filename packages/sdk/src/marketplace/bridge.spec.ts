import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameRegistry } from '../utils/frameRegistry.js';
import { MessageSecurityPolicy } from '../utils/messageSecurity.js';
import { createMarketplaceClient } from './client.js';
import { MARKETPLACE_LIST, MARKETPLACE_LIST_RESULT } from './messages.js';

describe('marketplace message origin', () => {
  const marketplace = 'https://marketplace.shellui.com';
  const other = 'https://notes.example';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function hostWindow() {
    const shellWindow = {
      location: { origin: 'https://app.example' },
      parent: null as unknown as Window,
    } as Window;
    shellWindow.parent = shellWindow;
    vi.stubGlobal('window', shellWindow);
    return shellWindow;
  }

  function policy() {
    const next = new MessageSecurityPolicy();
    next.configure({
      allowedOrigins: ['https://app.example', marketplace, other],
      marketplaceOrigin: marketplace,
    });
    return next;
  }

  function frame(src: string) {
    const registry = new FrameRegistry();
    const contentWindow = {} as Window;
    const iframe = {
      tagName: 'IFRAME',
      src,
      contentWindow,
    } as unknown as HTMLIFrameElement;
    registry.addIframe(iframe);
    registry.setCapabilityGrants([
      {
        origin: new URL(src).origin,
        thirdParty: true,
        capabilities: ['theme', 'locale', 'auth', 'ui'],
        urls: [src],
      },
    ]);
    return { registry, contentWindow };
  }

  it('rejects marketplace calls from any origin other than marketplace.url', () => {
    hostWindow();
    const { registry, contentWindow } = frame('https://notes.example/app/');
    const event = {
      origin: other,
      source: contentWindow,
      data: { type: MARKETPLACE_LIST },
    } as MessageEvent;
    expect(policy().explainUntrustedInboundMessage(event, registry, MARKETPLACE_LIST)).toMatch(
      /marketplace origin/,
    );
  });

  it('accepts marketplace calls from the configured origin', () => {
    hostWindow();
    const { registry, contentWindow } = frame(`${marketplace}/`);
    const event = {
      origin: marketplace,
      source: contentWindow,
      data: { type: MARKETPLACE_LIST },
    } as MessageEvent;
    expect(policy().explainUntrustedInboundMessage(event, registry, MARKETPLACE_LIST)).toBeNull();
  });

  it('drops spoofed auth on a third-party frame that requested it', () => {
    hostWindow();
    const { registry, contentWindow } = frame('https://notes.example/app/');
    const event = {
      origin: other,
      source: contentWindow,
      data: { type: 'SHELLUI_LOGIN' },
    } as MessageEvent;
    const next = new MessageSecurityPolicy();
    next.configure({ allowedOrigins: [other] });
    expect(next.explainUntrustedInboundMessage(event, registry, 'SHELLUI_LOGIN')).toMatch(/auth/);
    expect(registry.getCapabilityGrant(other)?.capabilities.has('auth')).toBe(false);
  });
});

describe('shellui.marketplace client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists installed apps through the host bridge', async () => {
    const parent = {
      location: { origin: 'https://shell.example' },
      postMessage: vi.fn(),
    };
    vi.stubGlobal('window', {
      parent,
      location: {
        origin: 'https://marketplace.shellui.com',
        href: 'https://marketplace.shellui.com/',
      },
      setTimeout,
      clearTimeout,
    });

    const listeners = new Map<string, (message: { payload?: unknown }) => void>();
    const client = createMarketplaceClient({
      addMessageListener(type, listener) {
        listeners.set(type, listener);
        return () => listeners.delete(type);
      },
    });

    const pending = client.listInstalledApps();
    expect(parent.postMessage).toHaveBeenCalled();
    const sent = parent.postMessage.mock.calls[0][0] as { type: string; payload: { id: string } };
    expect(sent.type).toBe(MARKETPLACE_LIST);
    listeners.get(MARKETPLACE_LIST_RESULT)?.({
      payload: {
        id: sent.payload.id,
        ok: true,
        apps: [
          {
            id: 'notes',
            name: 'Notes',
            origin: 'https://notes.example',
            url: 'https://notes.example/',
            path: 'notes',
            thirdParty: true,
            capabilities: ['theme', 'locale'],
            installedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: 'notes', thirdParty: true }),
    ]);
  });
});
