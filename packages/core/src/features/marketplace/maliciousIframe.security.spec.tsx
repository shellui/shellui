import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageSecurityPolicy, shellui } from '@shellui/sdk';
import { FrameRegistry } from '../../../../sdk/src/utils/frameRegistry.js';
import type { ShellUIConfig } from '../config/types';
import { validateChildFrameRegistration, clearChildFrames } from '../auth/appBackend/childFrames';
import { NavIcon } from '../layouts/sidebar/SidebarIcons';
import { deriveAllowedMessageOrigins } from '../messaging/deriveAllowedMessageOrigins';
import { isTrustedFrameForAuthToken } from '../security/trustedFrames';
import { THIRD_PARTY_IFRAME_SANDBOX, resolveContentFramePolicy } from './framePolicy';
import { prepareInstall } from './installApp';
import { clearInstalledAppRecords, replaceInstalledAppRecords } from './installedAppRegistry';
import { createMarketplaceNavigationItem, mergeNavigationOverlay } from './mergeNavigation';
import { emptyNavigationOverlay } from './overlay';
import { applyNavigationMessageSecurity } from './securitySync';

const APP = 'https://notes.example';
const APP_URL = 'https://notes.example/app/';
const MARKET = 'https://marketplace.shellui.com';

const COMMANDS = {
  ui: [
    'SHELLUI_OPEN_MODAL',
    'SHELLUI_CLOSE_MODAL',
    'SHELLUI_OPEN_DRAWER',
    'SHELLUI_CLOSE_DRAWER',
    'SHELLUI_TOAST',
    'SHELLUI_TOAST_UPDATE',
    'SHELLUI_DIALOG',
    'SHELLUI_DIALOG_UPDATE',
    'SHELLUI_ACTIONS_SET',
    'SHELLUI_ACTIONS_CLEAR',
    'SHELLUI_OVERLAY_SIZE',
  ],
  navigate: ['SHELLUI_NAVIGATE', 'SHELLUI_URL_CHANGED'],
  storage: ['SHELLUI_STORAGE_REQUEST', 'SHELLUI_SELECT_STORAGE'],
  ai: ['SHELLUI_AI_REQUEST'],
  auth: [
    'SHELLUI_LOGIN',
    'SHELLUI_LOGOUT',
    'SHELLUI_DELETE_ACCOUNT_REQUEST',
    'SHELLUI_UPDATE_PROFILE_REQUEST',
  ],
  childFrames: ['SHELLUI_CHILD_FRAME_REGISTER', 'SHELLUI_CHILD_FRAME_UNREGISTER'],
} as const;

function hostWindow() {
  const shellWindow: { location: { origin: string }; parent?: unknown } = {
    location: { origin: 'https://shell.example' },
  };
  shellWindow.parent = shellWindow;
  vi.stubGlobal('window', shellWindow);
}

function registeredFrame(src: string) {
  const registry = new FrameRegistry();
  const contentWindow = {} as Window;
  const iframe = {
    tagName: 'IFRAME',
    src,
    contentWindow,
  } as unknown as HTMLIFrameElement;
  const id = registry.addIframe(iframe);
  return { registry, contentWindow, iframe, id };
}

function policyFor(origins: string[]) {
  const policy = new MessageSecurityPolicy();
  policy.configure({ allowedOrigins: origins, marketplaceOrigin: MARKET });
  return policy;
}

function eventFor(contentWindow: Window, origin: string, type: string): MessageEvent {
  return { origin, source: contentWindow, data: { type } } as MessageEvent;
}

describe('malicious iframe security', () => {
  afterEach(() => {
    clearInstalledAppRecords();
    clearChildFrames();
    shellui.frameRegistry.setCapabilityGrants([]);
    shellui.configureMessageSecurity({ allowedOrigins: [], marketplaceOrigin: null });
    vi.unstubAllGlobals();
  });

  it('fails closed for every capability when a third-party install only has theme and locale', () => {
    hostWindow();
    const prepared = prepareInstall(
      {
        id: 'notes',
        name: 'Notes',
        url: APP_URL,
        thirdParty: true,
        capabilities: ['auth', 'childFrames'],
        safeForAuthToken: true,
        childFrames: { origins: ['https://child.example'] },
      },
      {
        allowThirdParty: true,
        takenPaths: new Set(),
        validation: { now: '2026-01-01T00:00:00.000Z', shellOrigin: 'https://shell.example' },
      },
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.record.capabilities).toEqual(['theme', 'locale']);

    const { registry, contentWindow } = registeredFrame(APP_URL);
    registry.setCapabilityGrants([
      {
        origin: APP,
        thirdParty: true,
        capabilities: [...prepared.record.capabilities, 'auth', 'safeForAuthToken', 'childFrames'],
        urls: [APP_URL],
      },
    ]);
    expect(registry.getCapabilityGrant(APP)?.capabilities.has('auth')).toBe(false);
    expect(registry.getCapabilityGrant(APP)?.capabilities.has('ui')).toBe(false);

    const policy = policyFor([APP, MARKET]);
    for (const [group, types] of Object.entries(COMMANDS)) {
      for (const type of types) {
        const reason = policy.explainUntrustedInboundMessage(
          eventFor(contentWindow, APP, type),
          registry,
          type,
        );
        expect(reason, `${group} ${type}`).toBeTruthy();
      }
    }
  });

  it('allows a granted capability and blocks it again as soon as Settings revokes it', () => {
    hostWindow();
    const { registry, contentWindow } = registeredFrame(APP_URL);
    const policy = policyFor([APP]);
    registry.setCapabilityGrants([
      { origin: APP, thirdParty: true, capabilities: ['theme', 'locale', 'ui'], urls: [APP_URL] },
    ]);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_DIALOG'),
        registry,
        'SHELLUI_DIALOG',
      ),
    ).toBeNull();
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_NAVIGATE'),
        registry,
        'SHELLUI_NAVIGATE',
      ),
    ).toBeTruthy();

    registry.setCapabilityGrants([
      { origin: APP, thirdParty: true, capabilities: ['theme', 'locale'], urls: [APP_URL] },
    ]);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_DIALOG'),
        registry,
        'SHELLUI_DIALOG',
      ),
    ).toMatch(/ui/);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_LOGIN'),
        registry,
        'SHELLUI_LOGIN',
      ),
    ).toMatch(/auth/);
  });

  it('still gates a third-party frame that navigates off its app path', () => {
    hostWindow();
    const escaped = 'https://notes.example/elsewhere';
    const { registry, contentWindow } = registeredFrame(escaped);
    registry.setCapabilityGrants([
      { origin: APP, thirdParty: true, capabilities: ['theme', 'locale', 'auth'], urls: [APP_URL] },
    ]);
    const policy = policyFor([APP]);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_LOGIN'),
        registry,
        'SHELLUI_LOGIN',
      ),
    ).toMatch(/auth/);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(contentWindow, APP, 'SHELLUI_STORAGE_REQUEST'),
        registry,
        'SHELLUI_STORAGE_REQUEST',
      ),
    ).toMatch(/storage/);
  });

  it('rejects shellui.marketplace calls from every origin except marketplace.url', () => {
    hostWindow();
    const evil = registeredFrame(APP_URL);
    const market = registeredFrame(`${MARKET}/`);
    const policy = policyFor([APP, MARKET, 'https://shell.example']);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(evil.contentWindow, APP, 'SHELLUI_MARKETPLACE_INSTALL'),
        evil.registry,
        'SHELLUI_MARKETPLACE_INSTALL',
      ),
    ).toMatch(/marketplace origin/);
    expect(
      policy.explainUntrustedInboundMessage(
        eventFor(market.contentWindow, MARKET, 'SHELLUI_MARKETPLACE_LIST'),
        market.registry,
        'SHELLUI_MARKETPLACE_LIST',
      ),
    ).toBeNull();
    expect(
      policy.explainUntrustedInboundMessage(
        {
          origin: 'https://shell.example',
          source: window,
          data: { type: 'SHELLUI_MARKETPLACE_UNINSTALL' },
        } as unknown as MessageEvent,
        evil.registry,
        'SHELLUI_MARKETPLACE_UNINSTALL',
      ),
    ).toMatch(/marketplace origin/);
  });

  it('refuses auth tokens, profile changes, and child frames from a crafted install', () => {
    const record = {
      id: 'notes',
      name: 'Notes',
      origin: APP,
      url: APP_URL,
      path: 'notes',
      thirdParty: true as const,
      capabilities: ['theme', 'locale'] as Array<'theme' | 'locale'>,
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    replaceInstalledAppRecords([record]);
    const spoofedConfig = {
      navigation: [
        {
          label: 'Notes',
          path: 'notes',
          url: 'https://notes.example/elsewhere',
          safeForAuthToken: true,
          childFrames: { origins: ['https://child.example'] },
        },
      ],
    } as ShellUIConfig;
    expect(isTrustedFrameForAuthToken('https://notes.example/elsewhere', spoofedConfig)).toBe(
      false,
    );
    expect(isTrustedFrameForAuthToken(APP_URL, spoofedConfig)).toBe(false);
    expect(
      validateChildFrameRegistration({
        from: ['host'],
        hostSrc: 'https://notes.example/elsewhere',
        payload: { frameId: 'child', url: 'https://child.example/' },
        config: spoofedConfig,
      }),
    ).toEqual({ ok: false, reason: 'third-party apps cannot embed apps' });
  });

  it('drops the origin and the frame as soon as the app is uninstalled', () => {
    const iframe = {
      tagName: 'IFRAME',
      src: 'https://notes.example/elsewhere',
      contentWindow: {} as Window,
    } as unknown as HTMLIFrameElement;
    const frameId = shellui.frameRegistry.addIframe(iframe);
    shellui.frameRegistry.setCapabilityGrants([
      { origin: APP, thirdParty: true, capabilities: ['theme', 'locale', 'ui'], urls: [APP_URL] },
    ]);
    const config = {
      navigation: [{ label: 'Home', path: 'home', url: 'https://home.example/' }],
    } as ShellUIConfig;
    const removed = applyNavigationMessageSecurity({
      config,
      navigation: mergeNavigationOverlay(
        config.navigation,
        emptyNavigationOverlay(),
        createMarketplaceNavigationItem(MARKET),
      ),
      apps: [],
      marketplaceOrigin: MARKET,
      removedAppUrls: [APP_URL],
    });
    expect(removed).toContain(frameId);
    expect(shellui.frameRegistry.getAllIframes()).toHaveLength(0);
    expect(shellui.frameRegistry.getCapabilityGrant(APP)).toBeUndefined();
    expect(shellui.messageSecurity.getAllowedOrigins()).not.toContain(APP);
    expect(
      deriveAllowedMessageOrigins({
        ...config,
        navigation: mergeNavigationOverlay(
          config.navigation,
          emptyNavigationOverlay(),
          createMarketplaceNavigationItem(MARKET),
        ),
      }),
    ).not.toContain(APP);
  });

  it('hardens third-party iframes and refuses inline SVG icons', () => {
    replaceInstalledAppRecords([
      {
        id: 'notes',
        name: 'Notes',
        origin: APP,
        url: APP_URL,
        path: 'notes',
        thirdParty: true,
        capabilities: ['theme', 'locale'],
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const policy = resolveContentFramePolicy('http://notes.example/', { thirdParty: true });
    expect(policy.permitted).toBe(false);
    expect(policy.referrerPolicy).toBe('no-referrer');
    expect(policy.allow).toBe('');
    expect(policy.sandbox).toBe(THIRD_PARTY_IFRAME_SANDBOX);
    expect(policy.sandbox).not.toContain('allow-top-navigation');
    expect(
      resolveContentFramePolicy('https://notes.example/', { thirdParty: true }).permitted,
    ).toBe(true);

    const remote = renderToStaticMarkup(
      createElement(NavIcon, { src: 'https://cdn.example/icon.png' }),
    );
    expect(remote).toContain('<img');
    expect(remote.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(remote).not.toContain('<svg');

    const inline = renderToStaticMarkup(
      createElement(NavIcon, { src: '<svg><script>alert(1)</script></svg>' }),
    );
    expect(inline).not.toContain('alert(1)');
    expect(inline).not.toContain('<img');
  });
});
