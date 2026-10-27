import type { CSSProperties } from 'react';
import type {
  OverlayOpenOptions,
  OverlaySizePreset,
  OverlaySizeValue,
  DrawerPosition,
} from '@shellui/sdk';
import { readDrawerBottomOffset, readSafeAreaInsetTop } from '../layouts/chrome/viewport';

/** CSS max-height for overlays — matches --shellui-overlay-max-height in index.css. */
const OVERLAY_MAX_HEIGHT_CSS = 'var(--shellui-overlay-max-height)';

/**
 * Largest floating drawer height: the shell height minus the top and bottom drawer
 * offsets (each is the gap plus the safe area). Matches --shellui-drawer-max-height.
 */
const DRAWER_MAX_HEIGHT_CSS = 'var(--shellui-drawer-max-height)';

/** Fraction of overlay max height — avoids raw dvh which disagrees with iOS standalone measure. */
function overlayHeightFrac(fraction: number): string {
  return `calc(${OVERLAY_MAX_HEIGHT_CSS} * ${fraction})`;
}

const PRESETS = new Set<string>(['sm', 'md', 'lg', 'xl', 'full', 'content']);

/**
 * Compact square while a dynamic modal waits for the first size report.
 */
export const DYNAMIC_OVERLAY_PENDING_PX = 112;

/**
 * Full-bleed loading strip height/width for dynamic drawers while pending.
 * Matches the integrated loading-bar animation.
 */
export const DYNAMIC_DRAWER_PENDING_PX = 40;

/**
 * Hidden iframe layout width while pending so content height is measured at a
 * realistic wrap width (not the spinner square), avoiding tall→short jumps.
 */
export const DYNAMIC_OVERLAY_MEASURE_WIDTH_PX = 420;

export function isOverlaySizePreset(value: unknown): value is OverlaySizePreset {
  return typeof value === 'string' && PRESETS.has(value);
}

export function toCssLength(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

/** Dialog (desktop/tablet modal) preset → class + inline style hints.
 * Width uses `calc(100vw - …)` gutters so tablets never edge-to-edge;
 * `max-w-*` still caps size on large desktops.
 * Heights derive from `--shellui-overlay-max-height` (not raw dvh). */
const DIALOG_PRESET: Record<
  OverlaySizePreset,
  { className: string; style?: CSSProperties; contentSized?: boolean }
> = {
  sm: {
    className:
      'max-w-sm w-[min(24rem,calc(100vw-3rem))] h-[min(calc(var(--shellui-overlay-max-height)*0.5),24rem)] max-h-[min(calc(var(--shellui-overlay-max-height)*0.7),28rem)] rounded-lg',
  },
  md: {
    className:
      'max-w-lg w-[min(32rem,calc(100vw-4rem))] h-[min(calc(var(--shellui-overlay-max-height)*0.6),32rem)] max-h-[min(calc(var(--shellui-overlay-max-height)*0.75),36rem)] rounded-lg',
  },
  lg: {
    // Wider than the 768px mobile breakpoint so iframe apps keep desktop UI
    className:
      'max-w-4xl w-[min(56rem,calc(100vw-5rem))] h-[min(calc(var(--shellui-overlay-max-height)*0.8),42.5rem)] max-h-[min(calc(var(--shellui-overlay-max-height)*0.8),42.5rem)] rounded-lg',
  },
  xl: {
    className:
      'max-w-6xl w-[min(72rem,calc(100vw-5rem))] h-[min(calc(var(--shellui-overlay-max-height)*0.85),50rem)] max-h-[min(calc(var(--shellui-overlay-max-height)*0.85),50rem)] rounded-lg',
  },
  full: {
    className:
      'max-w-[calc(100vw-2.5rem)] w-[calc(100vw-2.5rem)] h-[var(--shellui-overlay-max-height)] max-h-[var(--shellui-overlay-max-height)] rounded-lg',
  },
  content: {
    // Width comes from SHELLUI_OVERLAY_SIZE; max-w only caps. Avoid forcing 56rem
    // (that caused reflow: narrow measure → tall report → wide chrome → shorter report).
    className: 'max-w-4xl w-max rounded-lg',
    style: { height: 'auto', width: 'auto', maxHeight: OVERLAY_MAX_HEIGHT_CSS },
    contentSized: true,
  },
};

/** Drawer primary dimension presets (height for top/bottom, width for left/right). */
const DRAWER_PRESET_VERTICAL: Record<OverlaySizePreset, string> = {
  sm: overlayHeightFrac(0.4),
  md: overlayHeightFrac(0.55),
  lg: overlayHeightFrac(0.75),
  xl: overlayHeightFrac(0.9),
  full: DRAWER_MAX_HEIGHT_CSS,
  content: 'auto',
};

const DRAWER_PRESET_HORIZONTAL: Record<OverlaySizePreset, string> = {
  sm: '20rem',
  md: '28rem',
  lg: '36rem',
  xl: '48rem',
  full: 'calc(100% - 2 * var(--shellui-drawer-gap))',
  content: 'auto',
};

const DEFAULT_VERTICAL_DRAWER = overlayHeightFrac(0.8);

export interface ResolvedOverlaySize {
  className: string;
  style: CSSProperties;
  /** When true, listen for SHELLUI_OVERLAY_SIZE and grow with iframe content. */
  contentSized: boolean;
  /** Primary drawer CSS length (vaul size prop) when applicable. */
  drawerSize: string | null;
  /**
   * Phone sheets only: the preset height to use when the app never reports its
   * content size (no `shellui.overlay.autoSize()`), clamped by the drawer max height.
   */
  fallbackHeight?: string | null;
}

function applyExplicitDimensions(
  style: CSSProperties,
  options: Pick<OverlayOpenOptions, 'width' | 'height' | 'maxWidth' | 'maxHeight'>,
): CSSProperties {
  const next = { ...style };
  const width = toCssLength(options.width);
  const height = toCssLength(options.height);
  const maxWidth = toCssLength(options.maxWidth);
  const maxHeight = toCssLength(options.maxHeight);
  if (width) next.width = width;
  if (height) next.height = height;
  if (maxWidth) next.maxWidth = `min(${maxWidth}, 100vw)`;
  if (maxHeight) next.maxHeight = `min(${maxHeight}, ${OVERLAY_MAX_HEIGHT_CSS})`;
  return next;
}

export function isDynamicSizing(options?: OverlayOpenOptions | null): boolean {
  return options?.dynamicSizing === true || options?.size === 'content';
}

/**
 * Resolve modal (dialog) sizing from open options.
 * Default preset: `lg` (matches previous fixed chrome).
 */
export function resolveDialogSize(options?: OverlayOpenOptions | null): ResolvedOverlaySize {
  const dynamic = isDynamicSizing(options);
  const size = dynamic ? 'content' : options?.size;
  const preset: OverlaySizePreset = size && isOverlaySizePreset(size) ? size : 'lg';
  // Freeform CSS size on modal maps to height when not a preset
  const freeform = !dynamic && size && !isOverlaySizePreset(size) ? toCssLength(size) : undefined;

  const base = DIALOG_PRESET[preset];
  let style: CSSProperties = {
    transition: dynamic ? 'none' : 'height 200ms ease, width 200ms ease, max-height 200ms ease',
    ...base.style,
  };
  if (freeform) {
    style.height = freeform;
    style.maxHeight = `min(${freeform}, ${OVERLAY_MAX_HEIGHT_CSS})`;
  }
  style = applyExplicitDimensions(style, options ?? {});

  return {
    className: `${base.className} flex flex-col p-0 overflow-hidden`,
    style,
    contentSized: dynamic || base.contentSized === true || preset === 'content',
    drawerSize: null,
  };
}

/**
 * On viewports below the mobile breakpoint, every drawer edge presents as a
 * bottom sheet (same chrome as mobile `openModal`).
 */
export function resolveEffectiveDrawerPosition(
  position: DrawerPosition = 'right',
  isMobile = false,
): DrawerPosition {
  return isMobile ? 'bottom' : position;
}

/**
 * Resolve drawer sizing from open options + direction.
 * Default: 80% of overlay max / 80vw (previous 80dvh / 80vw behavior).
 */
export function resolveDrawerSize(
  options?: OverlayOpenOptions | null,
  position: DrawerPosition = 'right',
): ResolvedOverlaySize {
  const isVertical = position === 'top' || position === 'bottom';
  const dynamic = isDynamicSizing(options);
  const size = (dynamic ? 'content' : options?.size) as OverlaySizeValue | undefined;
  const contentSized = dynamic || size === 'content';

  let drawerSize: string;
  if (!size) {
    drawerSize = isVertical ? DEFAULT_VERTICAL_DRAWER : '80vw';
  } else if (isOverlaySizePreset(size)) {
    drawerSize = isVertical ? DRAWER_PRESET_VERTICAL[size] : DRAWER_PRESET_HORIZONTAL[size];
  } else {
    drawerSize = toCssLength(size) ?? (isVertical ? DEFAULT_VERTICAL_DRAWER : '80vw');
  }

  let style: CSSProperties = {
    transition: contentSized
      ? 'none'
      : 'height 200ms ease, width 200ms ease, max-height 200ms ease, max-width 200ms ease',
  };
  style = applyExplicitDimensions(style, options ?? {});

  // Explicit width/height override the primary drawer dimension
  if (isVertical && style.height) {
    drawerSize = String(style.height);
  } else if (!isVertical && style.width) {
    drawerSize = String(style.width);
  }

  if (contentSized) {
    drawerSize = 'auto';
    if (isVertical) {
      style.maxHeight = style.maxHeight ?? DRAWER_MAX_HEIGHT_CSS;
      style.height = style.height ?? 'auto';
    } else {
      style.maxWidth = style.maxWidth ?? 'min(90vw, 100%)';
      style.width = style.width ?? 'auto';
    }
  }

  return {
    className: 'p-0 overflow-hidden flex flex-col',
    style,
    contentSized,
    drawerSize: drawerSize === 'auto' ? null : drawerSize,
  };
}

/**
 * Resolve drawer size for the active viewport.
 *
 * Desktop: the requested edge and size.
 *
 * Phones: every drawer is a bottom sheet sized to its content. It listens for
 * SHELLUI_OVERLAY_SIZE and grows with the iframe up to the drawer max height
 * (8px plus the safe area above the bottom, the top below the notch), then the
 * iframe scrolls. The requested size only applies as `fallbackHeight` when the
 * app never reports. Horizontal freeform widths (`60vw`, `400px`, explicit
 * `width`) are dropped so they are not applied as height.
 */
export function resolveDrawerSizeForViewport(
  options?: OverlayOpenOptions | null,
  position: DrawerPosition = 'right',
  isMobile = false,
): ResolvedOverlaySize {
  const effective = resolveEffectiveDrawerPosition(position, isMobile);
  if (!isMobile) {
    return resolveDrawerSize(options, effective);
  }

  let presetOptions: OverlayOpenOptions | null | undefined = options;
  // left/right → bottom: width-oriented sizes must not become sheet height
  if (position === 'left' || position === 'right') {
    const dynamic = isDynamicSizing(options);
    const size = options?.size;
    const dropFreeformWidth =
      !dynamic && size !== undefined && size !== null && !isOverlaySizePreset(size);
    presetOptions = dropFreeformWidth
      ? { ...options, size: undefined, width: undefined }
      : options?.width !== undefined
        ? { ...options, width: undefined }
        : options;
  }

  const preset = resolveDrawerSize(presetOptions, 'bottom');
  const { width: _width, height: _height, ...rest } = presetOptions ?? {};
  const sheet = resolveDrawerSize({ ...rest, size: 'content' }, 'bottom');
  // Content sheets never exceed the drawer max height, whatever maxHeight asks for.
  sheet.style.maxHeight = DRAWER_MAX_HEIGHT_CSS;
  return {
    ...sheet,
    fallbackHeight: preset.contentSized
      ? null
      : `min(${preset.drawerSize ?? DEFAULT_VERTICAL_DRAWER}, ${DRAWER_MAX_HEIGHT_CSS})`,
  };
}

export type OverlayDismissOptions = {
  showCloseButton: boolean;
  dismissible: boolean;
  closeOnOverlayClick: boolean;
  showDragHandle: boolean;
};

export function resolveDismissOptions(
  options?: (OverlayOpenOptions & { showDragHandle?: boolean }) | null,
): OverlayDismissOptions {
  const dismissible = options?.dismissible !== false;
  const showDragHandle =
    options?.showDragHandle !== undefined ? options.showDragHandle : dismissible;
  return {
    showCloseButton: options?.showCloseButton !== false,
    dismissible,
    closeOnOverlayClick: options?.closeOnOverlayClick !== false,
    showDragHandle,
  };
}

/** How the shell presents a drawer: edge, drag handle, and whether Vaul snaps apply. */
export type DrawerChrome = {
  direction: DrawerPosition;
  showDragHandle: boolean;
  allowSnapPoints: boolean;
};

/**
 * Resolve drawer chrome for the active viewport.
 *
 * Phones (below md): every drawer, whatever edge was requested, is a bottom sheet
 * anchored above the home indicator, always with a drag handle for the thumb. Phone
 * sheets never snap: they sit at their content height (see
 * {@link resolveDrawerSizeForViewport}), so there is no half-height stop leaving
 * empty space under the actions.
 *
 * Content-sized drawers never snap on desktop either: a snap sheet is the expanded
 * height, so the iframe would report that height back and the sheet would end up
 * below the screen.
 *
 * Desktop: the requested edge, with the handle and snaps the options ask for.
 */
export function resolveDrawerChrome({
  position,
  isMobile,
  dismiss,
  pending = false,
  desktopResizable = false,
  contentSized = false,
}: {
  position?: DrawerPosition;
  isMobile: boolean;
  dismiss: Pick<OverlayDismissOptions, 'dismissible' | 'showDragHandle'>;
  pending?: boolean;
  desktopResizable?: boolean;
  contentSized?: boolean;
}): DrawerChrome {
  const direction = resolveEffectiveDrawerPosition(position, isMobile);
  if (isMobile) {
    return { direction, showDragHandle: !pending, allowSnapPoints: false };
  }
  const vertical = direction === 'top' || direction === 'bottom';
  const handle = dismiss.showDragHandle && dismiss.dismissible;
  return {
    direction,
    showDragHandle: !pending && vertical && handle,
    allowSnapPoints:
      direction === 'bottom' && handle && !pending && !desktopResizable && !contentSized,
  };
}

/**
 * Expanded bottom-sheet height leaves a tappable overlay band above the sheet:
 * top safe-area inset + {@link SHEET_EXPANDED_TOP_GAP_PX}. The floating sheet also
 * ends a gap above the home indicator (--shellui-drawer-bottom).
 */
export const SHEET_EXPANDED_TOP_GAP_PX = 60;

/** CSS height for the expanded floating bottom sheet. */
export const SHEET_EXPANDED_HEIGHT_CSS = `calc(var(--shellui-app-height) - var(--shellui-safe-area-top) - ${SHEET_EXPANDED_TOP_GAP_PX}px - var(--shellui-drawer-bottom))`;

/** Pixel height for the expanded sheet (matches {@link SHEET_EXPANDED_HEIGHT_CSS}). */
export function sheetExpandedHeightPx(
  viewportHeightPx?: number,
  safeAreaTopPx?: number,
  bottomOffsetPx?: number,
  topGapPx = SHEET_EXPANDED_TOP_GAP_PX,
): number {
  const viewport = viewportHeightPx ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
  let safeTop = safeAreaTopPx;
  if (safeTop === undefined) {
    safeTop = typeof document !== 'undefined' ? readSafeAreaInsetTop() : 0;
  }
  let bottom = bottomOffsetPx;
  if (bottom === undefined) {
    bottom = typeof document !== 'undefined' ? readDrawerBottomOffset() : 0;
  }
  return Math.max(0, Math.round(viewport - safeTop - topGapPx - bottom));
}

/** Vertical drawer presets → visible fraction of the window height. */
const VERTICAL_SNAP_BY_PRESET: Record<OverlaySizePreset, number> = {
  sm: 0.4,
  md: 0.55,
  lg: 0.75,
  xl: 0.9,
  full: 1,
  content: 0.5,
};

/**
 * Resolve `[normal, expanded]` Vaul snap points for a bottom sheet.
 * Returns null when the sheet is already near the expanded height (nothing useful to expand to).
 *
 * Vaul moves a bottom sheet by `translateY(H - snap)` as if the sheet started at the top
 * of the screen. The sheet is shorter than the viewport (h < H) and floats above the home
 * indicator, so to show a visible height v the snap is `v + (H - h)`, and the expanded
 * snap is `1` (no translate: the whole sheet shows, ending at its bottom offset).
 */
export function resolveBottomSheetSnapPoints(
  options?: OverlayOpenOptions | null,
  reportedHeightPx?: number | null,
  viewportHeightPx?: number,
  safeAreaTopPx?: number,
  bottomOffsetPx?: number,
): number[] | null {
  const viewport = viewportHeightPx ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
  if (!(viewport > 0)) return null;

  const sheetPx = sheetExpandedHeightPx(viewport, safeAreaTopPx, bottomOffsetPx);
  const expandedVisible = sheetPx / viewport;

  let normal: number;
  if (reportedHeightPx !== null && Number.isFinite(reportedHeightPx) && reportedHeightPx > 0) {
    normal = reportedHeightPx / viewport;
  } else {
    const dynamic = isDynamicSizing(options);
    const size = (dynamic ? 'content' : options?.size) as OverlaySizeValue | undefined;
    if (!size) {
      normal = 0.8;
    } else if (isOverlaySizePreset(size)) {
      if (size === 'full') return null;
      normal = VERTICAL_SNAP_BY_PRESET[size];
    } else if (typeof size === 'number' && Number.isFinite(size)) {
      normal = size / viewport;
    } else {
      const raw = String(size).trim();
      const vh = raw.match(/^([\d.]+)vh$/i);
      const px = raw.match(/^([\d.]+)px$/i);
      if (vh) normal = parseFloat(vh[1]) / 100;
      else if (px) normal = parseFloat(px[1]) / viewport;
      else normal = 0.8;
    }
  }

  // Already near expanded: expand would be a no-op
  if (normal >= expandedVisible - 0.04) return null;
  // Keep a meaningful gap between snaps
  normal = Math.min(Math.max(normal, 0.2), expandedVisible - 0.05);
  // Visible height → Vaul snap (add the part of the viewport the sheet never covers)
  const snap = normal + (viewport - sheetPx) / viewport;
  return [Number(snap.toFixed(4)), 1];
}
