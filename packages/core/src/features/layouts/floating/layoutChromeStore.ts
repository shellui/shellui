import { applyLayoutChromeStyles, shellui, type LayoutChrome } from '@shellui/sdk';
import { getChromeActionsForFrame } from '../../chromeActions/chromeActionsStore';
import {
  actionChromeFlags,
  computeActionInsets,
  mergeInsets,
  type ActionChromeFlags,
} from '../../chromeActions/computeActionInsets';

let currentChrome: LayoutChrome | null = null;

type LayoutChromeListener = () => void;
const layoutChromeListeners = new Set<LayoutChromeListener>();

function emitLayoutChrome(): void {
  for (const listener of layoutChromeListeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors.
    }
  }
}

/** Current layout-chrome snapshot (shell-side). Used when building settings for iframes. */
export function getPublishedLayoutChrome(): LayoutChrome | null {
  return currentChrome;
}

/** Subscribe to published layout-chrome changes (e.g. floating hide-on-scroll). */
export function subscribeLayoutChrome(listener: LayoutChromeListener): () => void {
  layoutChromeListeners.add(listener);
  return () => {
    layoutChromeListeners.delete(listener);
  };
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

function isWindowsLayout(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[data-shellui-windows-layout]'));
}

/**
 * Merge per-frame action-button insets into a base layout-chrome snapshot.
 * Sidebar / app-bar / fullscreen never publish floating chrome (`layout: 'none'`);
 * when actions are present we promote to `layout: 'actions'` so the SDK treats
 * insets as active and applies safe padding (same as overlay frames).
 */
export function buildFrameLayoutChrome(
  base: LayoutChrome,
  flags: ActionChromeFlags,
  options?: { topInTitleBar?: boolean },
): LayoutChrome {
  const primaryInDock =
    base.layout === 'floating' && (base.viewport === 'mobile' || base.viewport === 'tablet');
  const extra = computeActionInsets(flags, {
    topInTitleBar: options?.topInTitleBar,
    existingBottomInset: base.insets.bottom,
    primaryInDock,
  });
  const insets = mergeInsets(base.insets, extra);
  const hasActions = flags.hasTop || flags.hasPrimary;
  if (!hasActions) {
    return { ...base, insets };
  }
  if (base.layout === 'none') {
    return {
      ...base,
      layout: 'actions',
      chromeVisible: true,
      insets,
    };
  }
  return { ...base, insets };
}

function chromePayloadForFrame(uuid: string, base: LayoutChrome): LayoutChrome {
  const actions = getChromeActionsForFrame(uuid);
  return buildFrameLayoutChrome(base, actionChromeFlags(actions), {
    topInTitleBar: isWindowsLayout(),
  });
}

/**
 * Overlay / modal / drawer frames do not get floating sidebar / tab-bar insets.
 * They only receive padding for shellui.actions chrome (top bar + primary FAB)
 * so iframe content can clear those controls — and animate when set/clear.
 */
function chromePayloadForOverlayFrame(
  uuid: string,
  viewport: LayoutChrome['viewport'],
): LayoutChrome {
  const actions = getChromeActionsForFrame(uuid);
  const flags = actionChromeFlags(actions);
  const insets = computeActionInsets(flags, { topInTitleBar: false });
  const hasActions = flags.hasTop || flags.hasPrimary;
  return {
    layout: hasActions ? 'actions' : 'none',
    viewport,
    chromeVisible: hasActions,
    autoPadding: true,
    insets,
  };
}

/**
 * Publish layout chrome to iframes.
 * - Main frames: floating/nav insets + per-frame action chrome extras.
 * - Overlay frames: action chrome insets only (so set/clear animates content pad).
 * Apps apply insets via CSS vars / `shellui-apply-layout-chrome-pad`.
 *
 * Works for every shell layout (floating, sidebar, app-bar, …): when the base
 * chrome is cleared/`none`, action insets alone still activate padding.
 */
export function publishLayoutChrome(chrome: LayoutChrome | null): void {
  currentChrome = chrome;
  emitLayoutChrome();
  if (typeof window === 'undefined') return;

  const payload: LayoutChrome = chrome ?? CLEARED_CHROME;

  // Host shell document: vars only (no padding on the outer shell).
  applyLayoutChromeStyles(payload, { autoPadding: false });

  for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
    if (isMainLayoutFrame(iframe)) {
      shellui.sendMessage({
        type: 'SHELLUI_LAYOUT_CHROME',
        payload: { layoutChrome: chromePayloadForFrame(uuid, payload) },
        to: [uuid],
      });
      continue;
    }

    shellui.sendMessage({
      type: 'SHELLUI_LAYOUT_CHROME',
      payload: {
        layoutChrome: chromePayloadForOverlayFrame(uuid, payload.viewport),
      },
      to: [uuid],
    });
  }
}

/**
 * Re-apply the current published chrome (with fresh per-frame action insets).
 * Call after chrome actions set/clear/frame removal.
 */
export function republishLayoutChromeWithActions(): void {
  publishLayoutChrome(currentChrome);
}
