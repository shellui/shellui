import { describe, expect, test } from 'vitest';
import { isSafeIframeUrl, isSameOrigin } from './iframeUrlSafety';

const shellAt = (href: string) => {
  const url = new URL(href);
  return { href: url.href, protocol: url.protocol, host: url.host };
};

describe('isSafeIframeUrl', () => {
  const tauriShell = shellAt('tauri://localhost/dialog');

  test('accepts relative app URLs under a tauri://localhost shell', () => {
    expect(isSafeIframeUrl('/app#/toaster', tauriShell)).toBe(true);
    expect(isSafeIframeUrl('/app/#/dialog', tauriShell)).toBe(true);
    expect(isSafeIframeUrl('tauri://localhost/app#/layout', tauriShell)).toBe(true);
  });

  test('accepts http(s) URLs from any shell', () => {
    expect(isSafeIframeUrl('https://shellui.com/', tauriShell)).toBe(true);
    expect(isSafeIframeUrl('/app#/toaster', shellAt('https://playground.shellui.com/dialog'))).toBe(
      true,
    );
  });

  test('refuses another custom-scheme host than the shell', () => {
    expect(isSafeIframeUrl('tauri://evil/app', tauriShell)).toBe(false);
    expect(isSafeIframeUrl('other://localhost/app', tauriShell)).toBe(false);
  });

  test('still refuses javascript:, data: and invalid URLs', () => {
    for (const shell of [tauriShell, shellAt('https://playground.shellui.com/')]) {
      expect(isSafeIframeUrl('javascript:alert(1)', shell)).toBe(false);
      expect(isSafeIframeUrl('data:text/html,<script>alert(1)</script>', shell)).toBe(false);
      expect(isSafeIframeUrl('blob:https://playground.shellui.com/x', shell)).toBe(false);
    }
    expect(isSafeIframeUrl('http://[bad', tauriShell)).toBe(false);
  });
});

describe('isSameOrigin', () => {
  const tauriShell = shellAt('tauri://localhost/dialog');

  test('page-to-page under tauri://localhost stays on the nav item origin', () => {
    // Shell at /dialog switches to the Toaster item: URL built from the nav item URL.
    expect(isSameOrigin('/app#/toaster', '/app/#/toaster', tauriShell)).toBe(true);
    expect(
      isSafeIframeUrl('/app#/toaster', tauriShell) &&
        isSameOrigin('/app#/toaster', '/app/#/toaster', tauriShell),
    ).toBe(true);
  });

  test('different tauri hosts are not equal', () => {
    expect(isSameOrigin('tauri://localhost/app', 'tauri://other/app', tauriShell)).toBe(false);
    expect(isSameOrigin('tauri://localhost/app', 'other://localhost/app', tauriShell)).toBe(false);
  });

  test('compares http(s) origins as before', () => {
    expect(isSameOrigin('https://shellui.com/docs', 'https://shellui.com/', tauriShell)).toBe(true);
    expect(isSameOrigin('https://evil.com/', 'https://shellui.com/', tauriShell)).toBe(false);
    expect(isSameOrigin('http://shellui.com/', 'https://shellui.com/', tauriShell)).toBe(false);
  });

  test('opaque URLs never match', () => {
    expect(isSameOrigin('data:text/html,x', 'data:text/html,y', tauriShell)).toBe(false);
    expect(isSameOrigin('javascript:void 0', 'javascript:void 0', tauriShell)).toBe(false);
  });
});
