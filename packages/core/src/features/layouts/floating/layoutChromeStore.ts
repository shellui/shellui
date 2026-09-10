import type { LayoutChrome } from '@shellui/sdk';
import { applyLayoutChromeStyles, shellui } from '@shellui/sdk';

let currentChrome: LayoutChrome | null = null;

/** Current layout-chrome snapshot (shell-side). Used when building settings for iframes. */
export function getPublishedLayoutChrome(): LayoutChrome | null {
  return currentChrome;
}

/** Main layout content iframes only (not modal / drawer / picker overlays). */
export function isMainLayoutFrame(iframe: HTMLIFrameElement | null | undefined): boolean {
  if (!iframe) return false;
  return iframe.dataset.shelluiFrame !== 'overlay';
}

const CLEARED_CHROME: LayoutChrome = {
  layout: 'none',
  viewport: 'desktop',
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  chromeVisible: false,
  autoPadding: true,
};

/**
 * Publish layout chrome to main layout content frames only.
 * Overlay iframes (modal / drawer) are skipped. Apps apply insets inside their UI
 * via CSS vars / `shellui-apply-layout-chrome-pad` — the iframe stays 100%×100%.
 */
export function publishLayoutChrome(chrome: LayoutChrome | null): void {
  currentChrome = chrome;
  if (typeof window === 'undefined') return;

  const payload: LayoutChrome = chrome ?? CLEARED_CHROME;

  // Host shell document: vars only (no padding on the outer shell).
  applyLayoutChromeStyles(payload, { autoPadding: false });

  for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
    if (!isMainLayoutFrame(iframe)) continue;
    shellui.sendMessage({
      type: 'SHELLUI_LAYOUT_CHROME',
      payload: { layoutChrome: payload },
      to: [uuid],
    });
  }
}
