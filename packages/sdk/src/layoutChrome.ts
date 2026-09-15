import type { LayoutChrome, LayoutChromeInsets } from './types.js';

export const LAYOUT_CHROME_CSS_VARS = {
  top: '--shellui-inset-top',
  right: '--shellui-inset-right',
  bottom: '--shellui-inset-bottom',
  left: '--shellui-inset-left',
} as const;

/** Class apps can put on their content root to consume inset CSS vars as padding. */
export const LAYOUT_CHROME_PAD_CLASS = 'shellui-apply-layout-chrome-pad';

/**
 * When present on `html`, inset / pad transitions run. Absent during the first
 * settle after SDK init so action-chrome padding does not animate on page load.
 */
export const LAYOUT_CHROME_ANIMATE_ATTR = 'data-shellui-layout-chrome-animate';

/** Duration for live inset / padding transitions (sidebar, action chrome, etc.).
 * Keep in sync with floating sidebar `duration-200`. */
export const LAYOUT_CHROME_INSET_TRANSITION_MS = 200;

/**
 * Quiet period after the last boot-time chrome apply before enabling transitions.
 * Covers init seed + mount-time `actions.set()` without animating the first paint.
 */
export const LAYOUT_CHROME_ANIMATE_READY_MS = 150;

const LAYOUT_CHROME_PAD_STYLE_ID = 'shellui-layout-chrome-pad-styles';

const ZERO_INSETS: LayoutChromeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function hasPositiveInset(insets: LayoutChromeInsets): boolean {
  return insets.top > 0 || insets.right > 0 || insets.bottom > 0 || insets.left > 0;
}

/** Styles injected into iframe apps (core CSS does not reach cross-origin / child docs). */
export const LAYOUT_CHROME_PAD_CSS = `
@property --shellui-inset-top {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}
@property --shellui-inset-right {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}
@property --shellui-inset-bottom {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}
@property --shellui-inset-left {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}
.${LAYOUT_CHROME_PAD_CLASS} {
  padding-top: var(--shellui-inset-top, 0px);
  padding-right: var(--shellui-inset-right, 0px);
  padding-bottom: var(--shellui-inset-bottom, 0px);
  padding-left: var(--shellui-inset-left, 0px);
  box-sizing: border-box;
}
html[${LAYOUT_CHROME_ANIMATE_ATTR}] {
  transition:
    --shellui-inset-top ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    --shellui-inset-right ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    --shellui-inset-bottom ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    --shellui-inset-left ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[${LAYOUT_CHROME_ANIMATE_ATTR}] .${LAYOUT_CHROME_PAD_CLASS} {
  transition:
    padding-top ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    padding-right ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    padding-bottom ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    padding-left ${LAYOUT_CHROME_INSET_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[data-shellui-layout-chrome-pad] .overflow-y-auto,
html[data-shellui-layout-chrome-pad] .overflow-auto,
html[data-shellui-layout-chrome-pad] [data-shellui-chrome-scroll] {
  scroll-padding-top: var(--shellui-inset-top, 0px);
  scroll-padding-bottom: var(--shellui-inset-bottom, 0px);
  scroll-padding-left: var(--shellui-inset-left, 0px);
  scroll-padding-right: var(--shellui-inset-right, 0px);
}
@media (prefers-reduced-motion: reduce) {
  html[${LAYOUT_CHROME_ANIMATE_ATTR}] {
    transition: none;
  }
  html[${LAYOUT_CHROME_ANIMATE_ATTR}] .${LAYOUT_CHROME_PAD_CLASS} {
    transition: none;
  }
}
`.trim();

/** Toggle inset/pad CSS transitions on the document. */
export function setLayoutChromeAnimationsEnabled(
  enabled: boolean,
  el: HTMLElement = document.documentElement,
): void {
  if (enabled) el.setAttribute(LAYOUT_CHROME_ANIMATE_ATTR, '');
  else el.removeAttribute(LAYOUT_CHROME_ANIMATE_ATTR);
}
/**
 * Inject pad CSS into the app document. The shell's core CSS does not reach iframe
 * apps, so auto-padding must ship with the SDK.
 */
export function ensureLayoutChromePadStyles(doc: Document = document): void {
  if (typeof doc === 'undefined') return;
  let style = doc.getElementById(LAYOUT_CHROME_PAD_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = LAYOUT_CHROME_PAD_STYLE_ID;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  // Always refresh so SDK upgrades pick up inset transition CSS.
  style.textContent = LAYOUT_CHROME_PAD_CSS;
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
    /**
     * When false, snap insets (no CSS transition / no cold-start warmup).
     * Defaults to whether `html` already has `LAYOUT_CHROME_ANIMATE_ATTR`.
     */
    animate?: boolean;
  },
): void {
  if (typeof document === 'undefined') return;

  ensureLayoutChromePadStyles(document);

  const el = options?.el ?? document.documentElement;
  const animate = options?.animate ?? el.hasAttribute(LAYOUT_CHROME_ANIMATE_ATTR);
  setLayoutChromeAnimationsEnabled(animate, el);

  const insets = chrome?.insets ?? ZERO_INSETS;
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.top, `${insets.top}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.right, `${insets.right}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.bottom, `${insets.bottom}px`);
  el.style.setProperty(LAYOUT_CHROME_CSS_VARS.left, `${insets.left}px`);

  // Positive insets alone activate chrome (sidebar/app-bar publish layout "none"
  // until action buttons promote the snapshot to "actions").
  const active = Boolean(chrome && hasPositiveInset(insets));
  if (active) {
    el.setAttribute('data-shellui-layout-chrome', '');
  } else {
    el.removeAttribute('data-shellui-layout-chrome');
  }

  const autoPadding = options?.autoPadding ?? chrome?.autoPadding ?? true;
  // Keep the pad class whenever auto-padding is on — even at 0px — so CSS can
  // transition padding when action buttons (or floating chrome) show/hide.
  // Removing the class on clear caused an instant jump instead of an animation.
  const shouldPad = autoPadding;

  if (shouldPad) {
    el.setAttribute('data-shellui-layout-chrome-pad', '');
  } else {
    el.removeAttribute('data-shellui-layout-chrome-pad');
  }

  const body = document.body;
  const bodyHadPad = Boolean(body?.classList.contains(LAYOUT_CHROME_PAD_CLASS));
  const padTargetHadPad = Boolean(options?.padTarget?.classList.contains(LAYOUT_CHROME_PAD_CLASS));

  const togglePadClass = (node: HTMLElement | null | undefined) => {
    if (!node) return;
    if (shouldPad) node.classList.add(LAYOUT_CHROME_PAD_CLASS);
    else node.classList.remove(LAYOUT_CHROME_PAD_CLASS);
  };

  togglePadClass(body);
  if (options?.padTarget !== undefined) {
    togglePadClass(options.padTarget);
  }

  // After animations are enabled: pad class added in the same turn as non-zero
  // insets would jump. Snap vars to 0, reflow, then re-apply so CSS can run.
  // Skip on initial load (animate=false) — first paint should snap, not warm up.
  const needsWarmup =
    animate &&
    shouldPad &&
    hasPositiveInset(insets) &&
    ((!bodyHadPad && Boolean(body)) ||
      (options?.padTarget !== undefined && options.padTarget !== null && !padTargetHadPad));
  if (needsWarmup) {
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.top, '0px');
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.right, '0px');
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.bottom, '0px');
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.left, '0px');
    void el.offsetHeight;
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.top, `${insets.top}px`);
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.right, `${insets.right}px`);
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.bottom, `${insets.bottom}px`);
    el.style.setProperty(LAYOUT_CHROME_CSS_VARS.left, `${insets.left}px`);
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
