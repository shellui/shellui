import type { CSSProperties } from 'react';
import type {
  OverlayOpenOptions,
  OverlaySizePreset,
  OverlaySizeValue,
  DrawerPosition,
} from '@shellui/sdk';

const PRESETS = new Set<string>(['sm', 'md', 'lg', 'xl', 'full', 'content']);

/**
 * Compact square (modal) / strip (drawer) while waiting for the first
 * `SHELLUI_OVERLAY_SIZE` report when `dynamicSizing` / `size: 'content'`.
 */
export const DYNAMIC_OVERLAY_PENDING_PX = 112;

/**
 * Hidden iframe layout width while pending so content height is measured at a
 * realistic wrap width (not the 112px spinner), avoiding tall→short jumps.
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
 * `max-w-*` still caps size on large desktops. */
const DIALOG_PRESET: Record<
  OverlaySizePreset,
  { className: string; style?: CSSProperties; contentSized?: boolean }
> = {
  sm: {
    className:
      'max-w-sm w-[min(24rem,calc(100vw-3rem))] h-[min(50dvh,24rem)] max-h-[min(70dvh,28rem)] rounded-lg',
  },
  md: {
    className:
      'max-w-lg w-[min(32rem,calc(100vw-4rem))] h-[min(60dvh,32rem)] max-h-[min(75dvh,36rem)] rounded-lg',
  },
  lg: {
    // Wider than the 768px mobile breakpoint so iframe apps keep desktop UI
    className:
      'max-w-4xl w-[min(56rem,calc(100vw-5rem))] h-[min(80dvh,42.5rem)] max-h-[min(80dvh,42.5rem)] rounded-lg',
  },
  xl: {
    className:
      'max-w-6xl w-[min(72rem,calc(100vw-5rem))] h-[min(85dvh,50rem)] max-h-[min(85dvh,50rem)] rounded-lg',
  },
  full: {
    className:
      'max-w-[calc(100vw-2.5rem)] w-[calc(100vw-2.5rem)] h-[calc(100dvh-2.5rem)] max-h-[calc(100dvh-2.5rem)] rounded-lg',
  },
  content: {
    // Width comes from SHELLUI_OVERLAY_SIZE; max-w only caps. Avoid forcing 56rem
    // (that caused reflow: narrow measure → tall report → wide chrome → shorter report).
    className: 'max-w-4xl w-max rounded-lg',
    style: { height: 'auto', width: 'auto', maxHeight: 'min(90dvh, 100dvh - 2.5rem)' },
    contentSized: true,
  },
};

/** Drawer primary dimension presets (height for top/bottom, width for left/right). */
const DRAWER_PRESET_VERTICAL: Record<OverlaySizePreset, string> = {
  sm: '40dvh',
  md: '55dvh',
  lg: '75dvh',
  xl: '90dvh',
  full: '100dvh',
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
  if (maxHeight) next.maxHeight = `min(${maxHeight}, 100dvh)`;
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
    style.maxHeight = `min(${freeform}, 100dvh)`;
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
 * Resolve drawer sizing from open options + direction.
 * Default: 80dvh / 80vw (previous behavior).
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
    drawerSize = isVertical ? '80dvh' : '80vw';
  } else if (isOverlaySizePreset(size)) {
    drawerSize = isVertical ? DRAWER_PRESET_VERTICAL[size] : DRAWER_PRESET_HORIZONTAL[size];
  } else {
    drawerSize = toCssLength(size) ?? (isVertical ? '80dvh' : '80vw');
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
      style.maxHeight = style.maxHeight ?? 'min(90dvh, 100dvh)';
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
