import type { CSSProperties } from 'react';
import type {
  OverlayOpenOptions,
  OverlaySizePreset,
  OverlaySizeValue,
  DrawerPosition,
} from '@shellui/sdk';

/** CSS max-height for overlays — matches --shellui-overlay-max-height in index.css. */
const OVERLAY_MAX_HEIGHT_CSS = 'var(--shellui-overlay-max-height)';

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
  full: OVERLAY_MAX_HEIGHT_CSS,
  content: 'auto',
};

const DRAWER_PRESET_HORIZONTAL: Record<OverlaySizePreset, string> = {
  sm: '20rem',
  md: '28rem',
  lg: '36rem',
  xl: '48rem',
  full: '100%',
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
      style.maxHeight = style.maxHeight ?? OVERLAY_MAX_HEIGHT_CSS;
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
 * Mobile always uses bottom-sheet chrome; horizontal freeform widths (`60vw`,
 * `400px`, explicit `width`) are dropped so they are not applied as height.
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

  // left/right → bottom: width-oriented sizes must not become sheet height
  if (position === 'left' || position === 'right') {
    const dynamic = isDynamicSizing(options);
    const size = options?.size;
    const dropFreeformWidth =
      !dynamic && size !== undefined && size !== null && !isOverlaySizePreset(size);
    const nextOptions: OverlayOpenOptions | null | undefined = dropFreeformWidth
      ? { ...options, size: undefined, width: undefined }
      : options?.width !== undefined
        ? { ...options, width: undefined }
        : options;
    return resolveDrawerSize(nextOptions, 'bottom');
  }

  // top → bottom (or already bottom): keep height-oriented size
  return resolveDrawerSize(options, 'bottom');
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
