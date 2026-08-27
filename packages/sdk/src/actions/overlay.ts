/**
 * Overlay size reporting helpers for iframe content inside shellui modals/drawers.
 * Uses the SHELLUI_* message bus (not same-origin contentDocument hacks).
 */

import type { OverlayAutoSizeOptions, OverlayReportSizeOptions } from '../types.js';

const OVERLAY_SIZE_TYPE = 'SHELLUI_OVERLAY_SIZE';

let autoSizeCleanup: (() => void) | null = null;
let lastReported: { height: number; width?: number } | null = null;

function postToParent(message: { type: string; payload: Record<string, unknown> }): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}

function resolveTarget(target?: Element | string | null): Element | null {
  if (!target) return null;
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

/**
 * Measure content height. Prefer scrollHeight / child extents over offsetHeight —
 * when html/body are `height: 100%` of a fixed iframe, offsetHeight stays locked
 * to the viewport and never reflects growing content.
 */
function measureContentSize(root?: Element | null): { height: number; width: number } {
  if (root instanceof HTMLElement) {
    const rect = root.getBoundingClientRect();
    return {
      height: Math.ceil(Math.max(root.scrollHeight, root.offsetHeight, rect.height)),
      width: Math.ceil(Math.max(root.scrollWidth, root.offsetWidth, rect.width)),
    };
  }

  const doc = document.documentElement;
  const body = document.body;
  let height = Math.max(doc?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
  let width = Math.max(doc?.scrollWidth ?? 0, body?.scrollWidth ?? 0);

  // Body offsetHeight is often the iframe viewport — walk in-flow children instead
  if (body) {
    for (const child of Array.from(body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(child);
      if (style.display === 'none') continue;
      if (style.position === 'fixed') continue;
      const bottom = child.offsetTop + Math.max(child.scrollHeight, child.offsetHeight);
      const right = child.offsetLeft + Math.max(child.scrollWidth, child.offsetWidth);
      height = Math.max(height, bottom);
      width = Math.max(width, right);
    }
  }

  return { height: Math.ceil(height), width: Math.ceil(width) };
}

/**
 * Report overlay content size to the parent shell.
 * Parent applies the size immediately (no size transition for dynamic overlays).
 */
export function reportSize(options: OverlayReportSizeOptions): void {
  const height = Number(options?.height);
  if (!Number.isFinite(height) || height <= 0) {
    return;
  }

  const width =
    options.width !== undefined &&
    Number.isFinite(Number(options.width)) &&
    Number(options.width) > 0
      ? Number(options.width)
      : undefined;

  if (
    lastReported &&
    Math.abs(lastReported.height - height) < 1 &&
    (width === undefined ||
      lastReported.width === undefined ||
      Math.abs((lastReported.width ?? 0) - width) < 1)
  ) {
    return;
  }

  lastReported = { height, width };
  postToParent({
    type: OVERLAY_SIZE_TYPE,
    payload: {
      version: 1,
      height,
      ...(width !== undefined ? { width } : {}),
      ...(options.overlayId ? { overlayId: options.overlayId } : {}),
    },
  });
}

/**
 * Observe content size and report changes to the parent overlay.
 * Call once after `shellui.init()` when the page is shown inside a modal/drawer
 * with `dynamicSizing: true` or `size: 'content'`.
 *
 * Reports immediately by default (no debounce). Optional `debounceMs` coalesces
 * rapid ResizeObserver bursts. Skips no-op updates (&lt; 2px).
 * Pass `{ observe: false }` to tear down the observer.
 *
 * Tip: pass `target` as your content root (grows with children). Observing only
 * `html`/`body` often misses growth when they are height-locked to the iframe.
 */
export function autoSize(options: OverlayAutoSizeOptions = { observe: true }): () => void {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
    return () => undefined;
  }

  autoSizeCleanup?.();
  autoSizeCleanup = null;

  if (options.observe === false) {
    lastReported = null;
    return () => undefined;
  }

  const debounceMs = options.debounceMs ?? 0;
  const includeWidth = options.includeWidth ?? true;
  const overlayId = options.overlayId;
  const minDeltaPx = 2;
  const targetEl = resolveTarget(options.target ?? null);
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  let settleRaf = 0;

  const send = () => {
    const { height, width } = measureContentSize(targetEl);
    if (height <= 0) return;
    if (
      lastReported &&
      Math.abs(lastReported.height - height) < minDeltaPx &&
      (!includeWidth ||
        lastReported.width === undefined ||
        Math.abs((lastReported.width ?? 0) - width) < minDeltaPx)
    ) {
      return;
    }
    reportSize({
      height,
      ...(includeWidth ? { width } : {}),
      ...(overlayId ? { overlayId } : {}),
    });
  };

  /** Optional debounce; otherwise one rAF so layout settles within the same frame burst. */
  const schedule = () => {
    if (debounceMs > 0) {
      if (coalesceTimer) clearTimeout(coalesceTimer);
      coalesceTimer = setTimeout(() => {
        coalesceTimer = null;
        send();
      }, debounceMs);
      return;
    }
    if (settleRaf) return;
    settleRaf = requestAnimationFrame(() => {
      settleRaf = 0;
      send();
    });
  };

  // Reset so a new observe session always sends an initial size
  lastReported = null;
  send();

  const observer = new ResizeObserver(schedule);
  if (targetEl) {
    observer.observe(targetEl);
  } else {
    observer.observe(document.documentElement);
    if (document.body) {
      observer.observe(document.body);
      // Body border-box often stays fixed (height:100%); watch children that grow
      for (const child of Array.from(document.body.children)) {
        if (child instanceof Element) observer.observe(child);
      }
    }
  }

  // DOM changes that don't resize the observed box (e.g. toggling blocks)
  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(targetEl ?? document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener('load', send);

  const cleanup = () => {
    observer.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('load', send);
    if (coalesceTimer) {
      clearTimeout(coalesceTimer);
      coalesceTimer = null;
    }
    if (settleRaf) {
      cancelAnimationFrame(settleRaf);
      settleRaf = 0;
    }
    if (autoSizeCleanup === cleanup) autoSizeCleanup = null;
  };

  autoSizeCleanup = cleanup;
  return cleanup;
}
