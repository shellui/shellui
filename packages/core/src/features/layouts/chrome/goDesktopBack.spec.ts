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
  it('strips trailing slashes and hashes', () => {
    expect(normalizeHref('http://localhost/app/#/foo')).toBe('http://localhost/app');
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

  it('calls history.back when the iframe URL differs from its assigned src', () => {
    const back = vi.fn();
    const iframe = mockIframe({
      src: 'http://localhost/app',
      contentWindow: {
        location: { href: 'http://localhost/app/login' },
        history: { back, forward: vi.fn() },
      },
    });

    expect(tryGoBackInIframe(iframe, 'http://localhost')).toBe(true);
    expect(back).toHaveBeenCalledOnce();
  });

  it('does nothing when the iframe is still on its assigned src', () => {
    const back = vi.fn();
    const iframe = mockIframe({
      contentWindow: {
        location: { href: 'http://localhost/app' },
        history: { back, forward: vi.fn() },
      },
    });

    expect(tryGoBackInIframe(iframe, 'http://localhost')).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });
});

describe('tryGoForwardInIframe', () => {
  it('calls history.forward and succeeds when the URL changes', () => {
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

  it('returns false when forward does not change the URL', () => {
    const forward = vi.fn();
    const iframe = mockIframe({
      contentWindow: {
        location: { href: 'http://localhost/app' },
        history: { back: vi.fn(), forward },
      },
    });

    expect(tryGoForwardInIframe(iframe, 'http://localhost')).toBe(false);
    expect(forward).toHaveBeenCalledOnce();
  });
});

describe('goDesktopBack', () => {
  it('prefers iframe history over closing overlays', () => {
    const back = vi.fn();
    const closeOverlays = vi.fn();
    const iframes = [
      mockIframe({
        src: 'http://localhost/app',
        contentWindow: {
          location: { href: 'http://localhost/app/login' },
          history: { back, forward: vi.fn() },
        },
      }),
    ];

    expect(
      goDesktopBack({
        iframes,
        overlaysOpen: true,
        closeOverlays,
        baseHref: 'http://localhost',
      }),
    ).toBe('iframe');
    expect(back).toHaveBeenCalledOnce();
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

  it('falls back to router back', () => {
    const goRouterBack = vi.fn();
    expect(goDesktopBack({ iframes: [], goRouterBack })).toBe('router');
    expect(goRouterBack).toHaveBeenCalledOnce();
  });

  it('walks iframes from the topmost (last) entry', () => {
    expect(goBackInIframes([])).toBe(false);
    const topBack = vi.fn();
    const result = goBackInIframes(
      [
        mockIframe(),
        mockIframe({
          src: 'http://localhost/modal',
          contentWindow: {
            location: { href: 'http://localhost/modal/login' },
            history: { back: topBack, forward: vi.fn() },
          },
        }),
      ],
      'http://localhost',
    );
    expect(result).toBe(true);
    expect(topBack).toHaveBeenCalledOnce();
  });
});

describe('goDesktopForward', () => {
  it('prefers iframe forward over router', () => {
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
    ).toBe('iframe');
    expect(forward).toHaveBeenCalledOnce();
    expect(goRouterForward).not.toHaveBeenCalled();
  });

  it('falls back to router forward', () => {
    const goRouterForward = vi.fn();
    expect(goDesktopForward({ iframes: [], goRouterForward })).toBe('router');
    expect(goRouterForward).toHaveBeenCalledOnce();
  });
});
