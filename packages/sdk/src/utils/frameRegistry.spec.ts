import { describe, expect, it, vi, afterEach } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';

function fakeIframe(src: string, contentWindow: Window = {} as Window): HTMLIFrameElement {
  return { src, contentWindow, tagName: 'IFRAME' } as HTMLIFrameElement;
}

describe('FrameRegistry.adoptWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers an iframe found by contentWindow', () => {
    const contentWindow = {} as Window;
    const iframe = fakeIframe('http://localhost:5173/#/dialog', contentWindow);

    vi.stubGlobal('document', {
      querySelectorAll: () => [iframe],
    });
    vi.stubGlobal('window', { location: { href: 'http://localhost:4000/' } });

    const registry = new FrameRegistry();
    const uuid = registry.adoptWindow(contentWindow, 'http://localhost:5173');
    expect(uuid).toBeTruthy();
    expect(registry.getUuidByIframe(contentWindow)).toBe(uuid);
  });

  it('falls back to unique src origin when contentWindow identity does not match', () => {
    const eventSource = {} as Window;
    const iframe = fakeIframe('http://localhost:5173/#/dialog', {} as Window);

    vi.stubGlobal('document', {
      querySelectorAll: () => [iframe],
    });
    vi.stubGlobal('window', { location: { href: 'http://localhost:4000/' } });

    const registry = new FrameRegistry();
    const uuid = registry.adoptWindow(eventSource, 'http://localhost:5173');
    expect(uuid).toBeTruthy();
    expect(registry.getAllIframes()).toHaveLength(1);
    expect(registry.getAllIframes()[0][1]).toBe(iframe);
  });

  it('does not guess when multiple iframes share the same origin', () => {
    const eventSource = {} as Window;
    const a = fakeIframe('http://localhost:5173/#/a');
    const b = fakeIframe('http://localhost:5173/#/b');

    vi.stubGlobal('document', {
      querySelectorAll: () => [a, b],
    });
    vi.stubGlobal('window', { location: { href: 'http://localhost:4000/' } });

    const registry = new FrameRegistry();
    expect(registry.adoptWindow(eventSource, 'http://localhost:5173')).toBeUndefined();
    expect(registry.getAllIframes()).toHaveLength(0);
  });

  it('addIframe is idempotent for the same element', () => {
    const iframe = fakeIframe('http://localhost:5173/');
    const registry = new FrameRegistry();
    const a = registry.addIframe(iframe);
    const b = registry.addIframe(iframe);
    expect(a).toBe(b);
    expect(registry.getAllIframes()).toHaveLength(1);
  });
});
