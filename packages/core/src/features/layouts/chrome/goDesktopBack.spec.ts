import { describe, expect, it, vi } from 'vitest';
import { IFRAME_FOREIGN_ATTR } from './constants';
import {
  goBackInIframes,
  goDesktopBack,
  goDesktopForward,
  normalizeHref,
  tryGoBackInIframe,
  tryGoForwardInIframe,
  type DesktopBackIframe,
} from './goDesktopBack';

function mockIframe(
  overrides: Partial<DesktopBackIframe> & { foreign?: boolean } = {},
): DesktopBackIframe {
  const { foreign, ...rest } = overrides;
  const attrs: Record<string, string> = {};
  if (foreign) attrs[IFRAME_FOREIGN_ATTR] = 'true';
  const src = rest.src ?? 'http://localhost/app';
  attrs.src = src;

  const iframe: DesktopBackIframe = {
    isConnected: rest.isConnected ?? true,
    src,
    contentWindow: rest.contentWindow ?? {
      location: { href: src },
      history: { back: vi.fn(), forward: vi.fn() },
    },
    getAttribute: (name) => attrs[name] ?? null,
    removeAttribute: (name) => {
      delete attrs[name];
    },
  };

  return {
    ...iframe,
    ...rest,
    getAttribute: iframe.getAttribute,
    removeAttribute: iframe.removeAttribute,
  };
}

describe('normalizeHref', () => {
  it('strips trailing slashes but keeps hash for hash-router apps', () => {
    expect(normalizeHref('http://localhost/app/#/foo')).toBe('http://localhost/app#/foo');
    expect(normalizeHref('http://localhost/app/')).toBe('http://localhost/app');
  });
});

describe('tryGoBackInIframe', () => {
  it('resets src when the iframe navigated to a foreign origin', () => {
    const iframe = mockIframe({
      foreign: true,
      src: 'http://localhost/app',
    });
    iframe.src = 'https://accounts.example/login';

    expect(tryGoBackInIframe(iframe)).toBe(true);
    expect(iframe.src).toBe('http://localhost/app');
    expect(iframe.getAttribute(IFRAME_FOREIGN_ATTR)).toBeNull();
  });

  it('does not use iframe history for same-origin SPA routes (shell owns history)', () => {
    const back = vi.fn();
    const iframe = mockIframe({
      src: 'http://localhost/app',
      contentWindow: {
        location: { href: 'http://localhost/app/login' },
        history: { back, forward: vi.fn() },
      },
    });

    expect(tryGoBackInIframe(iframe, 'http://localhost')).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it('does not use iframe history when only the hash differs', () => {
    const back = vi.fn();
    const iframe = mockIframe({
      src: 'http://localhost:5173/#/',
      contentWindow: {
        location: { href: 'http://localhost:5173/#/layout' },
        history: { back, forward: vi.fn() },
      },
    });

    expect(tryGoBackInIframe(iframe, 'http://localhost:5173/')).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });
});

describe('tryGoForwardInIframe', () => {
  it('still detects whether forward would change the URL', () => {
    const location = { href: 'http://localhost/app' };
    const forward = vi.fn(() => {
      location.href = 'http://localhost/app/login';
    });
    const iframe = mockIframe({
      src: 'http://localhost/app',
      contentWindow: {
        location,
        history: { back: vi.fn(), forward },
      },
    });

    expect(tryGoForwardInIframe(iframe, 'http://localhost')).toBe(true);
    expect(forward).toHaveBeenCalledOnce();
  });
});

describe('goDesktopBack', () => {
  it('prefers foreign iframe reset over closing overlays', () => {
    const closeOverlays = vi.fn();
    const iframes = [
      mockIframe({
        foreign: true,
        src: 'http://localhost/app',
      }),
    ];
    iframes[0].src = 'https://accounts.example/login';

    expect(
      goDesktopBack({
        iframes,
        overlaysOpen: true,
        closeOverlays,
        baseHref: 'http://localhost',
      }),
    ).toBe('iframe');
    expect(iframes[0].src).toBe('http://localhost/app');
    expect(closeOverlays).not.toHaveBeenCalled();
  });

  it('closes overlays when iframes cannot go back', () => {
    const closeOverlays = vi.fn();
    expect(
      goDesktopBack({
        iframes: [mockIframe()],
        overlaysOpen: true,
        closeOverlays,
        baseHref: 'http://localhost',
      }),
    ).toBe('overlay');
    expect(closeOverlays).toHaveBeenCalledOnce();
  });

  it('falls back to router back for mirrored SPA navigations', () => {
    const goRouterBack = vi.fn();
    const back = vi.fn();
    expect(
      goDesktopBack({
        iframes: [
          mockIframe({
            src: 'http://localhost:5173/#/',
            contentWindow: {
              location: { href: 'http://localhost:5173/#/layout' },
              history: { back, forward: vi.fn() },
            },
          }),
        ],
        goRouterBack,
        baseHref: 'http://localhost:5173/',
      }),
    ).toBe('router');
    expect(goRouterBack).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });

  it('falls back to router back when no iframe action applies', () => {
    const goRouterBack = vi.fn();
    expect(goDesktopBack({ iframes: [], goRouterBack })).toBe('router');
    expect(goRouterBack).toHaveBeenCalledOnce();
  });

  it('walks iframes from the topmost (last) entry for foreign resets', () => {
    expect(goBackInIframes([])).toBe(false);
    const top = mockIframe({
      foreign: true,
      src: 'http://localhost/modal',
    });
    top.src = 'https://accounts.example/login';
    const result = goBackInIframes([mockIframe(), top], 'http://localhost');
    expect(result).toBe(true);
    expect(top.src).toBe('http://localhost/modal');
  });
});

describe('goDesktopForward', () => {
  it('uses router forward (shell owns mirrored SPA history)', () => {
    const location = { href: 'http://localhost/app' };
    const forward = vi.fn(() => {
      location.href = 'http://localhost/app/next';
    });
    const goRouterForward = vi.fn();
    expect(
      goDesktopForward({
        iframes: [
          mockIframe({
            contentWindow: {
              location,
              history: { back: vi.fn(), forward },
            },
          }),
        ],
        goRouterForward,
        baseHref: 'http://localhost',
      }),
    ).toBe('router');
    expect(goRouterForward).toHaveBeenCalledOnce();
    expect(forward).not.toHaveBeenCalled();
  });

  it('falls back to router forward', () => {
    const goRouterForward = vi.fn();
    expect(goDesktopForward({ iframes: [], goRouterForward })).toBe('router');
    expect(goRouterForward).toHaveBeenCalledOnce();
  });
});
