/** @vitest-environment happy-dom */
/** @vitest-environment-options {"settings":{"disableIframePageLoading":true}} */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AppFrameOptions } from './utils/appFrame.js';

const frames: AppFrameOptions[] = [];
vi.mock('./index.js', () => ({
  createAppFrame: (_iframe: HTMLIFrameElement, options: AppFrameOptions) => {
    frames.push(options);
    return { frameId: `f${frames.length}`, origin: new URL(options.url).origin, destroy() {} };
  },
}));

const { ShelluiFrame } = await import('./react.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  frames.length = 0;
  document.body.innerHTML = '';
});

function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const mounted = createRoot(host);
  root = mounted;
  const render = (src: string, extra: Record<string, unknown> = {}) =>
    act(() => mounted.render(createElement(ShelluiFrame, { src, title: 'child', ...extra })));
  const iframe = () => host.querySelector('iframe') as HTMLIFrameElement;
  return { host, render, iframe };
}

function trackSrc(iframe: HTMLIFrameElement) {
  const sets: string[] = [];
  const proto = Object.getPrototypeOf(iframe);
  const desc = Object.getOwnPropertyDescriptor(proto, 'src');
  Object.defineProperty(iframe, 'src', {
    configurable: true,
    get: () => desc?.get?.call(iframe),
    set: (v: string) => {
      sets.push(v);
      desc?.set?.call(iframe, v);
    },
  });
  return sets;
}

describe('ShelluiFrame', () => {
  it('does not reload or re-register when src mirrors child navigation', () => {
    const { render, iframe } = mount();
    render('https://admin.example.com/#/');
    expect(frames).toHaveLength(1);
    const sets = trackSrc(iframe());
    const replace = vi.fn();
    Object.defineProperty(iframe(), 'contentWindow', {
      configurable: true,
      value: { location: { replace } },
    });

    // Child reports a hash route; the host mirrors it into src.
    act(() => frames[0].onNavigate?.({ pathname: '/', search: '', hash: '#/groups' }));
    render('https://admin.example.com/#/groups');

    expect(sets).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
  });

  it('navigates the running child for host-driven changes without setting src', () => {
    const { render, iframe } = mount();
    render('https://admin.example.com/#/users');
    const sets = trackSrc(iframe());
    const replace = vi.fn();
    Object.defineProperty(iframe(), 'contentWindow', {
      configurable: true,
      value: { location: { replace } },
    });
    render('https://admin.example.com/#/groups');
    expect(replace).toHaveBeenCalledWith('https://admin.example.com/#/groups');
    expect(sets).toEqual([]);
    expect(frames).toHaveLength(1);
  });

  it('shows the session failure reason from the shell', () => {
    const { host, render } = mount();
    render('https://admin.example.com/');
    act(() =>
      frames[0].onSession?.({
        ok: false,
        reason: 'identity_error_page',
        hint: 'redirect_to is not allowed',
      }),
    );
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.getAttribute('data-shellui-frame-error')).toBe('identity_error_page');
    expect(alert?.textContent).toContain('redirect_to is not allowed');
  });
});
