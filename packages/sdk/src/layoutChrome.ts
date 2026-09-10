import type { LayoutChrome, LayoutChromeInsets } from './types.js';

export const LAYOUT_CHROME_CSS_VARS = {
  top: '--shellui-inset-top',
  right: '--shellui-inset-right',
  bottom: '--shellui-inset-bottom',
  left: '--shellui-inset-left',
} as const;

/** Class apps can put on their content root to consume inset CSS vars as padding. */
export const LAYOUT_CHROME_PAD_CLASS = 'shellui-apply-layout-chrome-pad';

const LAYOUT_CHROME_PAD_STYLE_ID = 'shellui-layout-chrome-pad-styles';

const ZERO_INSETS: LayoutChromeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function hasPositiveInset(insets: LayoutChromeInsets): boolean {
  return insets.top > 0 || insets.right > 0 || insets.bottom > 0 || insets.left > 0;
}

/**
 * Inject pad CSS into the app document. The shell's core CSS does not reach iframe
 * apps, so auto-padding must ship with the SDK.
 */
export function ensureLayoutChromePadStyles(doc: Document = document): void {
  if (typeof doc === 'undefined') return;
  if (doc.getElementById(LAYOUT_CHROME_PAD_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = LAYOUT_CHROME_PAD_STYLE_ID;
  style.textContent = `
.${LAYOUT_CHROME_PAD_CLASS} {
  padding-top: var(--shellui-inset-top, 0px);
  padding-right: var(--shellui-inset-right, 0px);
  padding-bottom: var(--shellui-inset-bottom, 0px);
  padding-left: var(--shellui-inset-left, 0px);
  box-sizing: border-box;
}
html[data-shellui-layout-chrome-pad] .overflow-y-auto,
html[data-shellui-layout-chrome-pad] .overflow-auto,
html[data-shellui-layout-chrome-pad] [data-shellui-chrome-scroll] {
  scroll-padding-top: var(--shellui-inset-top, 0px);
  scroll-padding-bottom: var(--shellui-inset-bottom, 0px);
  scroll-padding-left: var(--shellui-inset-left, 0px);
  scroll-padding-right: var(--shellui-inset-right, 0px);
}
`.trim();
  (doc.head ?? doc.documentElement).appendChild(style);
}

/**
 * Write inset CSS variables from a layout-chrome snapshot.
 * Does not shrink the iframe or `#root` — apps apply padding with
 * `.shellui-apply-layout-chrome-pad` or by reading `--shellui-inset-*`.
 *
 * When `autoPadding` is true, adds `LAYOUT_CHROME_PAD_CLASS` on `document.body`
 * so simple apps get content insets automatically.
 */
export function applyLayoutChromeStyles(
  chrome: LayoutChrome | null | undefined,
  options?: {
    el?: HTMLElement;
    /** Override chrome.autoPadding. */
    autoPadding?: boolean;
    /** Extra element to toggle LAYOUT_CHROME_PAD_CLASS on (in addition to body when auto). */
    padTarget?: HTMLElement | null;
  },
): void {
  if (typeof document === 'undefined') return;

  ensureLayoutChromePadStyles(document);

  const el = options?.el ?? document.documentElement;
  const insets = chrome?.insets ?? ZERO_INSETS;
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.top, `${insets.top}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.right, `${insets.right}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.bottom, `${insets.bottom}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.left, `${insets.left}px`);

  const active = Boolean(chrome && chrome.layout !== 'none' && hasPositiveInset(insets));
  if (active) {
    el.setAttribute('data-shellui-layout-chrome', '');
  } else {
    el.removeAttribute('data-shellui-layout-chrome');
  }

  const autoPadding = options?.autoPadding ?? chrome?.autoPadding ?? true;
  const shouldPad = autoPadding && active;

  if (shouldPad) {
    el.setAttribute('data-shellui-layout-chrome-pad', '');
  } else {
    el.removeAttribute('data-shellui-layout-chrome-pad');
  }

  const togglePadClass = (node: HTMLElement | null | undefined) => {
    if (!node) return;
    if (shouldPad) node.classList.add(LAYOUT_CHROME_PAD_CLASS);
    else node.classList.remove(LAYOUT_CHROME_PAD_CLASS);
  };

  togglePadClass(document.body);
  if (options?.padTarget !== undefined) {
    togglePadClass(options.padTarget);
  }
}

export type ContentScrollDirection = 'up' | 'down' | 'none';

export type ScrollChromeState = {
  visible: boolean;
  lastY: number;
};

export type ScrollMetrics = {
  scrollY: number;
  /** Pixels of scroll range remaining until the bottom (0 ≈ at bottom). */
  distanceFromBottom: number;
};

/** Read scrollY + distance-from-bottom from a scroll event target (document or element). */
export function getScrollMetrics(target: EventTarget | null): ScrollMetrics | null {
  if (typeof window === 'undefined') return null;

  if (target === document || target === document.documentElement || target === document.body) {
    const el = document.documentElement;
    const scrollY = window.scrollY || el.scrollTop || document.body.scrollTop || 0;
    const distanceFromBottom = Math.max(0, el.scrollHeight - window.innerHeight - scrollY);
    return { scrollY, distanceFromBottom };
  }

  if (target instanceof HTMLElement) {
    const scrollY = target.scrollTop;
    const distanceFromBottom = Math.max(
      0,
      target.scrollHeight - target.clientHeight - target.scrollTop,
    );
    return { scrollY, distanceFromBottom };
  }

  return null;
}

/**
 * Reduce scroll position into chrome visibility with hysteresis.
 * Near the top or bottom always reveals chrome; small deltas are ignored.
 */
export function reduceScrollChromeVisibility(
  state: ScrollChromeState,
  scrollY: number,
  options?: {
    threshold?: number;
    topReveal?: number;
    /** Reveal when this close to the bottom (px). Default 72. */
    bottomReveal?: number;
    distanceFromBottom?: number;
  },
): ScrollChromeState {
  const threshold = options?.threshold ?? 8;
  const topReveal = options?.topReveal ?? 24;
  const bottomReveal = options?.bottomReveal ?? 72;
  const y = Math.max(0, scrollY);

  if (y <= topReveal) {
    return { visible: true, lastY: y };
  }

  const distanceFromBottom = options?.distanceFromBottom;
  if (typeof distanceFromBottom === 'number' && distanceFromBottom <= bottomReveal) {
    return { visible: true, lastY: y };
  }

  const delta = y - state.lastY;
  if (Math.abs(delta) < threshold) {
    return { visible: state.visible, lastY: y };
  }

  if (delta > 0) {
    return { visible: false, lastY: y };
  }
  return { visible: true, lastY: y };
}

export function scrollDirectionFromDelta(delta: number, threshold = 8): ContentScrollDirection {
  if (Math.abs(delta) < threshold) return 'none';
  return delta > 0 ? 'down' : 'up';
}
