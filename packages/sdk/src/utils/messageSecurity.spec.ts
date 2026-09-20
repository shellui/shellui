import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';
import {
  MessageSecurityPolicy,
  collectOriginsFromUrls,
  PRIVILEGED_COMPANION_MESSAGE_TYPES,
  isIframeReadyForTargetOrigin,
  resolveIframeTargetOrigin,
  resolveParentTargetOrigin,
} from './messageSecurity.js';

describe('MessageSecurityPolicy', () => {
  let policy: MessageSecurityPolicy;
  const shellWindow = {
    location: { origin: 'https://app.example.com' },
    parent: null as unknown as Window,
  } as Window;
  shellWindow.parent = shellWindow;

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
    // Companion view: embedded under a distinct parent window at the same origin
    // (prod same-origin embed) — source is parent, origin is allowed via window origin.
    const parentWindow = { location: { origin: 'https://app.example.com' } } as Window;
    const companionWindow = {
      location: { origin: 'https://app.example.com' },
      parent: parentWindow,
    } as Window;
    vi.stubGlobal('window', companionWindow);
    vi.stubGlobal('document', {
      location: companionWindow.location,
      referrer: '',
    });

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
    expect(PRIVILEGED_COMPANION_MESSAGE_TYPES.has('SHELLUI_AI_REQUEST')).toBe(true);
  });
});

describe('MessageSecurityPolicy embedded companion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('auto-allows cross-origin parent shell (:4000 → :5173)', () => {
    const parentWindow = { location: { origin: 'http://localhost:4000' } } as Window;
    const companionWindow = {
      location: { origin: 'http://localhost:5173', ancestorOrigins: ['http://localhost:4000'] },
      parent: parentWindow,
    } as Window;
    vi.stubGlobal('window', companionWindow);
    vi.stubGlobal('document', {
      location: companionWindow.location,
      referrer: 'http://localhost:4000/',
    });

    const policy = new MessageSecurityPolicy();
    expect(policy.isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(policy.isOriginAllowed('http://localhost:4000')).toBe(true);
    expect(policy.isOriginAllowed('https://evil.example.com')).toBe(false);

    const event = {
      origin: 'http://localhost:4000',
      source: parentWindow,
      data: { type: 'SHELLUI_SETTINGS' },
    } as MessageEvent;
    expect(policy.isTrustedInboundMessage(event, null, 'SHELLUI_SETTINGS')).toBe(true);
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

describe('isIframeReadyForTargetOrigin', () => {
  it('returns false while about:blank still inherits the shell origin', () => {
    const iframe = {
      src: 'http://localhost:5173/#/',
      contentWindow: {
        location: { origin: 'http://localhost:4000' },
      },
    } as HTMLIFrameElement;

    expect(isIframeReadyForTargetOrigin(iframe, 'http://localhost:5173')).toBe(false);
  });

  it('returns true when the readable origin matches the target', () => {
    const iframe = {
      src: 'http://localhost:4000/app/',
      contentWindow: {
        location: { origin: 'http://localhost:4000' },
      },
    } as HTMLIFrameElement;

    expect(isIframeReadyForTargetOrigin(iframe, 'http://localhost:4000')).toBe(true);
  });

  it('returns true when location is cross-origin (SecurityError)', () => {
    const iframe = {
      src: 'http://localhost:5173/#/',
      contentWindow: {
        get location() {
          throw new DOMException('Blocked a frame', 'SecurityError');
        },
      },
    } as HTMLIFrameElement;

    expect(isIframeReadyForTargetOrigin(iframe, 'http://localhost:5173')).toBe(true);
  });
});

describe('resolveParentTargetOrigin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns self origin when not embedded', () => {
    const self = {
      location: { origin: 'https://shell.example.com' },
    } as Window & { parent: Window };
    self.parent = self;
    vi.stubGlobal('window', self);
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    expect(resolveParentTargetOrigin()).toBe('https://shell.example.com');
  });

  it('uses ancestorOrigins when embedded', () => {
    const parentWin = {} as Window;
    vi.stubGlobal('window', {
      parent: parentWin,
      location: { origin: 'http://localhost:5173' },
    } as Window);
    vi.stubGlobal('document', {
      referrer: '',
      location: { ancestorOrigins: { 0: 'http://localhost:4000', length: 1 } },
    });

    expect(resolveParentTargetOrigin()).toBe('http://localhost:4000');
  });

  it('falls back to * when embedded without ancestorOrigins or referrer', () => {
    const parentWin = {} as Window;
    vi.stubGlobal('window', {
      parent: parentWin,
      location: { origin: 'http://localhost:5173' },
    } as Window);
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    expect(resolveParentTargetOrigin()).toBe('*');
  });
});

describe('explainUntrustedInboundMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains allowlist rejection for early localhost companion messages', () => {
    const policy = new MessageSecurityPolicy();
    // Only shell origin from window — companion not configured yet (pre-bootstrap race).
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:4000' },
      parent: {} as Window,
    } as Window);
    policy.configure({ allowedOrigins: [] });

    const iframeWindow = {} as Window;
    const frameRegistry = {
      getUuidByIframe: (win: Window | null | undefined) =>
        win === iframeWindow ? 'frame-1' : undefined,
    } as FrameRegistry;

    const event = {
      origin: 'http://localhost:5173',
      source: iframeWindow,
      data: { type: 'SHELLUI_SETTINGS_REQUESTED' },
    } as MessageEvent;

    expect(
      policy.explainUntrustedInboundMessage(event, frameRegistry, 'SHELLUI_SETTINGS_REQUESTED'),
    ).toMatch(/origin not allowlisted/);

    policy.configure({ allowedOrigins: ['http://localhost:5173'] });
    expect(
      policy.explainUntrustedInboundMessage(event, frameRegistry, 'SHELLUI_SETTINGS_REQUESTED'),
    ).toBeNull();
  });

  it('accepts shell SETTINGS from parent even when parent origin was not pre-allowlisted', () => {
    const parentWin = {} as Window;
    const companionWin = {
      location: { origin: 'http://localhost:5173' },
      parent: parentWin,
    } as Window;
    vi.stubGlobal('window', companionWin);
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    const policy = new MessageSecurityPolicy();
    policy.configure({ allowedOrigins: [] });

    const event = {
      origin: 'http://localhost:4000',
      source: parentWin,
      data: { type: 'SHELLUI_SETTINGS' },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, null, 'SHELLUI_SETTINGS')).toBe(true);
  });
});
