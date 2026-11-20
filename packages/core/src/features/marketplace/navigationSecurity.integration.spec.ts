import { afterEach, describe, expect, it } from 'vitest';
import { shellui } from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import { validateChildFrameRegistration, clearChildFrames } from '../auth/appBackend/childFrames';
import { deriveAllowedMessageOrigins } from '../messaging/deriveAllowedMessageOrigins';
import { isTrustedFrameForAuthToken } from '../security/trustedFrames';
import { createMarketplaceNavigationItem, mergeNavigationOverlay } from './mergeNavigation';
import { clearInstalledAppRecords, replaceInstalledAppRecords } from './installedAppRegistry';
import { emptyNavigationOverlay, type InstalledAppRecord } from './overlay';
import { applyNavigationMessageSecurity } from './securitySync';

const notes: InstalledAppRecord = {
  id: 'notes',
  name: 'Notes',
  origin: 'https://notes.example',
  url: 'https://notes.example/app/',
  path: 'notes',
  thirdParty: true,
  capabilities: ['theme', 'locale', 'ui'],
  installedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const config = {
  title: 'Shell',
  navigation: [
    { label: 'Home', path: 'home', url: 'https://home.example/', safeForAuthToken: true },
  ],
} as ShellUIConfig;

describe('navigation overlay security', () => {
  afterEach(() => {
    clearInstalledAppRecords();
    clearChildFrames();
    shellui.frameRegistry.setCapabilityGrants([]);
    shellui.configureMessageSecurity({ allowedOrigins: [], marketplaceOrigin: null });
  });

  it('adds an installed origin to the allowlist and removes it on uninstall', () => {
    const withApp = mergeNavigationOverlay(
      config.navigation,
      { ...emptyNavigationOverlay(), installedApps: [notes] },
      createMarketplaceNavigationItem('https://marketplace.shellui.com'),
    );
    const installedOrigins = deriveAllowedMessageOrigins({ ...config, navigation: withApp });
    expect(installedOrigins).toContain('https://notes.example');
    expect(installedOrigins).toContain('https://marketplace.shellui.com');
    expect(installedOrigins).toContain('https://home.example');

    const withoutApp = mergeNavigationOverlay(
      config.navigation,
      emptyNavigationOverlay(),
      createMarketplaceNavigationItem('https://marketplace.shellui.com'),
    );
    const removedOrigins = deriveAllowedMessageOrigins({ ...config, navigation: withoutApp });
    expect(removedOrigins).not.toContain('https://notes.example');
    expect(removedOrigins).toContain('https://marketplace.shellui.com');
  });

  it('unregisters the app frame and refuses auth and child frames', () => {
    const iframe = {
      tagName: 'IFRAME',
      src: notes.url,
      contentWindow: {} as Window,
    } as unknown as HTMLIFrameElement;
    const frameId = shellui.frameRegistry.addIframe(iframe);

    replaceInstalledAppRecords([notes]);
    const navigation = mergeNavigationOverlay(
      config.navigation,
      { ...emptyNavigationOverlay(), installedApps: [notes] },
      createMarketplaceNavigationItem('https://marketplace.shellui.com'),
    );
    applyNavigationMessageSecurity({
      config,
      navigation,
      apps: [notes],
      marketplaceOrigin: 'https://marketplace.shellui.com',
      removedAppUrls: [],
    });

    expect(shellui.messageSecurity.getAllowedOrigins()).toContain('https://notes.example');
    expect(isTrustedFrameForAuthToken(notes.url, { ...config, navigation })).toBe(false);
    expect(
      validateChildFrameRegistration({
        from: [frameId],
        hostSrc: notes.url,
        payload: { frameId: 'child', url: 'https://child.example/' },
        config: {
          ...config,
          navigation: [
            {
              label: 'Notes',
              path: 'notes',
              url: notes.url,
              safeForAuthToken: true,
              childFrames: { origins: ['https://child.example'] },
            },
          ],
        },
      }),
    ).toEqual({ ok: false, reason: 'third-party apps cannot embed apps' });

    const grant = shellui.frameRegistry.getCapabilityGrant(notes.origin);
    expect(grant?.capabilities.has('auth')).toBe(false);
    expect(grant?.capabilities.has('ui')).toBe(true);

    applyNavigationMessageSecurity({
      config,
      navigation: mergeNavigationOverlay(
        config.navigation,
        emptyNavigationOverlay(),
        createMarketplaceNavigationItem('https://marketplace.shellui.com'),
      ),
      apps: [],
      marketplaceOrigin: 'https://marketplace.shellui.com',
      removedAppUrls: [notes.url],
    });

    expect(shellui.frameRegistry.getAllIframes().some(([id]) => id === frameId)).toBe(false);
    expect(shellui.frameRegistry.getCapabilityGrant(notes.origin)).toBeUndefined();
    expect(shellui.messageSecurity.getAllowedOrigins()).not.toContain('https://notes.example');
  });
});
