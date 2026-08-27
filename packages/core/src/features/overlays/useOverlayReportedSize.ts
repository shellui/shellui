import { useCallback, useEffect, useRef, useState } from 'react';
import { shellui, type OverlaySizePayload, type ShellUIMessage } from '@shellui/sdk';

const MIN_CONTENT_HEIGHT = 120;
const MAX_VIEWPORT_RATIO = 0.92;
/** If no size messages arrive, fall back to a scrollable preset height. */
const FALLBACK_MS = 1500;
const FALLBACK_HEIGHT_RATIO = 0.6;

export type ReportedOverlaySize = {
  height: number;
  width?: number;
};

/**
 * Listen for `SHELLUI_OVERLAY_SIZE` from iframe content and expose clamped dimensions.
 * Debounces rapid updates; ignores invalid / no-op values.
 * When `enabled` is false (non-content presets), reported size stays null (preset + inner scroll).
 * If no messages arrive within FALLBACK_MS, returns a viewport-relative fallback height
 * so the overlay remains usable with inner scroll.
 */
export function useOverlayReportedSize(enabled: boolean, active: boolean) {
  const [reported, setReported] = useState<ReportedOverlaySize | null>(null);
  const [fallback, setFallback] = useState(false);
  const lastRef = useRef<ReportedOverlaySize | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    lastRef.current = null;
    setReported(null);
    setFallback(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      reset();
    }
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
      const clampedH = Math.min(Math.max(Math.ceil(height), MIN_CONTENT_HEIGHT), maxH);

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
        (clampedW === undefined ||
          prev.width === undefined ||
          Math.abs((prev.width ?? 0) - clampedW) < 1)
      ) {
        return;
      }

      const next = { height: clampedH, width: clampedW };
      lastRef.current = next;
      setFallback(false);
      setReported(next);
    };

    const cleanup = shellui.addMessageListener('SHELLUI_OVERLAY_SIZE', (data: ShellUIMessage) => {
      const payload = data.payload as OverlaySizePayload;
      if (payload?.version !== undefined && payload.version !== 1) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => apply(payload), 50);
    });

    return () => {
      cleanup();
      if (timerRef.current) clearTimeout(timerRef.current);
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
        }
      : null);

  return { reported: effectiveReported, usedFallback: fallback && !reported, reset };
}
