import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';
import {
  MessageSecurityPolicy,
  collectOriginsFromUrls,
  PRIVILEGED_COMPANION_MESSAGE_TYPES,
  resolveIframeTargetOrigin,
  resolveParentTargetOrigin,
} from './messageSecurity.js';

describe('MessageSecurityPolicy', () => {
  let policy: MessageSecurityPolicy;
  const shellWindow = {
    location: { origin: 'https://app.example.com' },
    parent: {} as Window,
  } as Window;

  beforeEach(() => {
    policy = new MessageSecurityPolicy();
    policy.configure({
      allowedOrigins: ['https://app.example.com', 'http://localhost:3000'],
    });
    vi.stubGlobal('window', shellWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows configured and window origins', () => {
    expect(policy.isOriginAllowed('https://app.example.com')).toBe(true);
    expect(policy.isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(policy.isOriginAllowed('https://evil.example.com')).toBe(false);
    expect(policy.isOriginAllowed('null')).toBe(false);
  });

  it('rejects hostile origin for privileged messages', () => {
    const iframeWindow = {} as Window;
    const frameRegistry = {
      getUuidByIframe: (win: Window | null | undefined) =>
        win === iframeWindow ? 'frame-1' : undefined,
    } as FrameRegistry;

    const event = {
      origin: 'https://evil.example.com',
      source: iframeWindow,
      data: { type: 'SHELLUI_LOGIN' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_LOGIN')).toBe(false);
  });

  it('rejects unregistered frame at allowed origin for privileged messages', () => {
    const frameRegistry = new FrameRegistry();
    const hostileWindow = {} as Window;

    const event = {
      origin: 'https://app.example.com',
      source: hostileWindow,
      data: { type: 'SHELLUI_OPEN_MODAL' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_OPEN_MODAL')).toBe(false);
  });

  it('accepts registered frame at allowed origin for privileged messages', () => {
    const iframeWindow = {} as Window;
    const frameRegistry = {
      getUuidByIframe: (win: Window | null | undefined) =>
        win === iframeWindow ? 'frame-1' : undefined,
    } as FrameRegistry;

    const event = {
      origin: 'https://app.example.com',
      source: iframeWindow,
      data: { type: 'SHELLUI_TOAST' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_TOAST')).toBe(true);
  });

  it('accepts same-window privileged messages at allowed origin', () => {
    const event = {
      origin: 'https://app.example.com',
      source: shellWindow,
      data: { type: 'SHELLUI_ACTIONS_SET' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, null, 'SHELLUI_ACTIONS_SET')).toBe(true);
  });

  it('allows parent source for shell → companion responses', () => {
    const parentWindow = shellWindow.parent;

    const event = {
      origin: 'https://app.example.com',
      source: parentWindow,
      data: { type: 'SHELLUI_SETTINGS' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, null, 'SHELLUI_SETTINGS')).toBe(true);
  });

  it('covers privileged companion message types used by auth/modal/dialog/toast', () => {
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_LOGIN')).toBe(true);
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_LOGOUT')).toBe(true);
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_DIALOG')).toBe(true);
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_TOAST')).toBe(true);
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_OPEN_MODAL')).toBe(true);
  });
});

describe('collectOriginsFromUrls', () => {
  it('extracts unique origins from absolute URLs', () => {
    expect(
      collectOriginsFromUrls(
        'https://files.example.com/app/',
        'http://localhost:3000/#/home',
        'not-a-url',
        'https://files.example.com/other',
      ),
    ).toEqual(['https://files.example.com', 'http://localhost:3000']);
  });
});

describe('resolveIframeTargetOrigin', () => {
  it('uses iframe src origin when available', () => {
    const iframe = {
      src: 'https://cdn.example.com/app/index.html',
    } as HTMLIFrameElement;
    expect(resolveIframeTargetOrigin(iframe, 'https://shell.example.com')).toBe(
      'https://cdn.example.com',
    );
  });

  it('falls back when src is about:blank', () => {
    const iframe = { src: 'about:blank' } as HTMLIFrameElement;
    expect(resolveIframeTargetOrigin(iframe, 'https://shell.example.com')).toBe(
      'https://shell.example.com',
    );
  });
});

describe('resolveParentTargetOrigin', () => {
  it('returns self origin when not embedded', () => {
    vi.stubGlobal('window', {
      parent: globalThis,
      location: { origin: 'https://shell.example.com', ancestorOrigins: undefined },
    } as Window);
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    expect(resolveParentTargetOrigin()).toBe('https://shell.example.com');
  });
});
