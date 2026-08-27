import { useCallback, useEffect, useRef, useState } from 'react';
import { shellui, type OverlaySizePayload, type ShellUIMessage } from '@shellui/sdk';

const MIN_CONTENT_HEIGHT = 120;
const MAX_VIEWPORT_RATIO = 0.92;
/** If no size messages arrive, fall back to a scrollable preset height. */
const FALLBACK_MS = 1500;
const FALLBACK_HEIGHT_RATIO = 0.6;
/** Keep last size through overlay close animation, then clear. */
const CLOSE_SIZE_CLEAR_MS = 280;

export type ReportedOverlaySize = {
  height: number;
  width?: number;
  /** True when the raw content height exceeded the viewport max and was clamped. */
  wasClamped?: boolean;
};

/**
 * Listen for `SHELLUI_OVERLAY_SIZE` from iframe content and expose clamped dimensions.
 * Applies immediately (no debounce). Ignores invalid / no-op values.
 * When `enabled` is false (non-content presets), reported size stays null (preset + inner scroll).
 * If no messages arrive within FALLBACK_MS, returns a viewport-relative fallback height
 * so the overlay remains usable with inner scroll.
 *
 * On close: last size is kept for CLOSE_SIZE_CLEAR_MS so exit animation does not
 * shrink back to the pending spinner. On open: size resets immediately (pending again).
 */
export function useOverlayReportedSize(enabled: boolean, active: boolean) {
  const [reported, setReported] = useState<ReportedOverlaySize | null>(null);
  const [fallback, setFallback] = useState(false);
  const lastRef = useRef<ReportedOverlaySize | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    lastRef.current = null;
    setReported(null);
    setFallback(false);
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (active) {
      // Fresh open — clear so pending spinner shows until the first report
      reset();
      return;
    }
    // Keep last size through the close animation, then clear for next open
    const t = window.setTimeout(reset, CLOSE_SIZE_CLEAR_MS);
    return () => window.clearTimeout(t);
  }, [active, reset]);

  useEffect(() => {
    if (!enabled || !active) return;

    fallbackTimerRef.current = setTimeout(() => {
      if (!lastRef.current) {
        setFallback(true);
      }
    }, FALLBACK_MS);

    const apply = (payload: OverlaySizePayload) => {
      const height = Number(payload?.height);
      if (!Number.isFinite(height) || height <= 0) return;

      const maxH = Math.floor(window.innerHeight * MAX_VIEWPORT_RATIO);
      const rawH = Math.ceil(height);
      const clampedH = Math.min(Math.max(rawH, MIN_CONTENT_HEIGHT), maxH);
      const wasClamped = rawH > maxH;

      let clampedW: number | undefined;
      if (payload.width !== undefined) {
        const width = Number(payload.width);
        if (Number.isFinite(width) && width > 0) {
          const maxW = Math.floor(window.innerWidth * MAX_VIEWPORT_RATIO);
          clampedW = Math.min(Math.ceil(width), maxW);
        }
      }

      const prev = lastRef.current;
      if (
        prev &&
        Math.abs(prev.height - clampedH) < 1 &&
        prev.wasClamped === wasClamped &&
        (clampedW === undefined ||
          prev.width === undefined ||
          Math.abs((prev.width ?? 0) - clampedW) < 1)
      ) {
        return;
      }

      const next = { height: clampedH, width: clampedW, wasClamped };
      lastRef.current = next;
      setFallback(false);
      setReported(next);
    };

    const cleanup = shellui.addMessageListener('SHELLUI_OVERLAY_SIZE', (data: ShellUIMessage) => {
      const payload = data.payload as OverlaySizePayload;
      if (payload?.version !== undefined && payload.version !== 1) return;
      apply(payload);
    });

    return () => {
      cleanup();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [enabled, active]);

  const effectiveReported =
    reported ??
    (fallback && enabled
      ? {
          height: Math.floor(
            (typeof window !== 'undefined' ? window.innerHeight : 600) * FALLBACK_HEIGHT_RATIO,
          ),
          wasClamped: true,
        }
      : null);

  return {
    reported: effectiveReported,
    usedFallback: fallback && !reported,
    wasClamped: Boolean(effectiveReported?.wasClamped),
    reset,
  };
}
