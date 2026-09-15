/**
 * Mobile bottom-sidebar height presets (sidebar / sidebar-inset layouts).
 * Fractions of `--shellui-overlay-max-height`, aligned with vertical drawer presets.
 */
export type MobileSidebarSize = 'sm' | 'md' | 'lg';

export const MOBILE_SIDEBAR_SIZES: readonly MobileSidebarSize[] = ['sm', 'md', 'lg'] as const;

/** Default open size when config / provider do not specify one. */
export const DEFAULT_MOBILE_SIDEBAR_SIZE: MobileSidebarSize = 'md';

/**
 * Height as a fraction of `--shellui-overlay-max-height`.
 * Matches drawer vertical presets for Evidence-shell density.
 */
export const MOBILE_SIDEBAR_SIZE_FRACTIONS: Record<MobileSidebarSize, number> = {
  sm: 0.4,
  md: 0.55,
  lg: 0.75,
};

/** Drag below this fraction of the `sm` height → close on release. */
export const MOBILE_SIDEBAR_CLOSE_HEIGHT_RATIO = 0.5;

/** Extra pixels below `sm` that also force close (mobile-friendly). */
export const MOBILE_SIDEBAR_CLOSE_EXTRA_PX = 48;

const SIZE_SET = new Set<string>(MOBILE_SIDEBAR_SIZES);

export function isMobileSidebarSize(value: unknown): value is MobileSidebarSize {
  return typeof value === 'string' && SIZE_SET.has(value);
}

export function normalizeMobileSidebarSize(
  value: unknown,
  fallback: MobileSidebarSize = DEFAULT_MOBILE_SIDEBAR_SIZE,
): MobileSidebarSize {
  return isMobileSidebarSize(value) ? value : fallback;
}

/** CSS height for a size preset (uses overlay max-height token). */
export function resolveMobileSidebarHeightCss(size: MobileSidebarSize): string {
  const fraction = MOBILE_SIDEBAR_SIZE_FRACTIONS[size];
  return `calc(var(--shellui-overlay-max-height) * ${fraction})`;
}

/** Pixel height for a size given the current overlay max height. */
export function resolveMobileSidebarHeightPx(
  size: MobileSidebarSize,
  overlayMaxHeightPx: number,
): number {
  const max = Math.max(0, overlayMaxHeightPx);
  return Math.round(max * MOBILE_SIDEBAR_SIZE_FRACTIONS[size]);
}

export type MobileSidebarSnapResult = MobileSidebarSize | 'close';

/**
 * Snap a live drag height to sm/md/lg, or close when dragged far enough down.
 */
export function snapMobileSidebarHeight(
  heightPx: number,
  overlayMaxHeightPx: number,
): MobileSidebarSnapResult {
  const max = Math.max(1, overlayMaxHeightPx);
  const smPx = resolveMobileSidebarHeightPx('sm', max);
  const closeBelow = Math.max(
    smPx * MOBILE_SIDEBAR_CLOSE_HEIGHT_RATIO,
    smPx - MOBILE_SIDEBAR_CLOSE_EXTRA_PX,
  );

  if (heightPx <= closeBelow) {
    return 'close';
  }

  let nearest: MobileSidebarSize = 'sm';
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const size of MOBILE_SIDEBAR_SIZES) {
    const target = resolveMobileSidebarHeightPx(size, max);
    const dist = Math.abs(heightPx - target);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = size;
    }
  }
  return nearest;
}

/**
 * Clamp a live drag height between a small dismiss band and lg.
 * Allows overscroll below sm so the sheet can follow the finger toward close.
 */
export function clampMobileSidebarDragHeight(heightPx: number, overlayMaxHeightPx: number): number {
  const max = Math.max(1, overlayMaxHeightPx);
  const lgPx = resolveMobileSidebarHeightPx('lg', max);
  // Allow pulling almost closed while dragging (visual follow-through).
  const minPx = Math.round(max * 0.08);
  return Math.min(lgPx, Math.max(minPx, Math.round(heightPx)));
}
