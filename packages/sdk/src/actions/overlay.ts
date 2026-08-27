/**
 * Overlay size reporting helpers for iframe content inside shellui modals/drawers.
 * Uses the SHELLUI_* message bus (not same-origin contentDocument hacks).
 */

import type { OverlayAutoSizeOptions, OverlayReportSizeOptions } from '../types.js';

const OVERLAY_SIZE_TYPE = 'SHELLUI_OVERLAY_SIZE';

let autoSizeCleanup: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastReported: { height: number; width?: number } | null = null;

function postToParent(message: { type: string; payload: Record<string, unknown> }): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}

function measureContentSize(): { height: number; width: number } {
  const doc = document.documentElement;
  const body = document.body;
  const height = Math.ceil(
    Math.max(
      doc?.scrollHeight ?? 0,
      doc?.offsetHeight ?? 0,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
    ),
  );
  const width = Math.ceil(
    Math.max(
      doc?.scrollWidth ?? 0,
      doc?.offsetWidth ?? 0,
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
    ),
  );
  return { height, width };
}

/**
 * Report overlay content size to the parent shell.
 * Parent animates the modal/drawer to this height (clamped to the viewport).
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
 * Observe document size and report changes to the parent overlay.
 * Call once after `shellui.init()` when the page is shown inside a modal/drawer
 * with size preset `content` (or when you want the overlay to grow with content).
 *
 * Pass `{ observe: false }` (or call again after stopping) to tear down the observer.
 */
export function autoSize(options: OverlayAutoSizeOptions = { observe: true }): () => void {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
    return () => undefined;
  }

  autoSizeCleanup?.();
  autoSizeCleanup = null;

  if (options.observe === false) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    return () => undefined;
  }

  const debounceMs = options.debounceMs ?? 100;
  const includeWidth = options.includeWidth ?? false;
  const overlayId = options.overlayId;

  const send = () => {
    const { height, width } = measureContentSize();
    reportSize({
      height,
      ...(includeWidth ? { width } : {}),
      ...(overlayId ? { overlayId } : {}),
    });
  };

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(send, debounceMs);
  };

  // Initial report (load / first open)
  send();

  const observer = new ResizeObserver(schedule);
  observer.observe(document.documentElement);
  if (document.body) observer.observe(document.body);

  window.addEventListener('load', send);

  const cleanup = () => {
    observer.disconnect();
    window.removeEventListener('load', send);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (autoSizeCleanup === cleanup) autoSizeCleanup = null;
  };

  autoSizeCleanup = cleanup;
  return cleanup;
}
