'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/z-index';
import { readCssLengthPx } from '../../features/layouts/chrome/viewport';

export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

const MIN_DRAWER_SIZE = 240;
/** Fallback edge offset (desktop gap) when the CSS token cannot be read. */
const FALLBACK_DRAWER_OFFSET_PX = 12;

const Drawer = ({
  open,
  onOpenChange,
  direction = 'right',
  dismissible = true,
  handleOnly,
  ...props
}: ComponentProps<typeof VaulDrawer.Root> & {
  direction?: DrawerDirection;
}) => {
  // Left/right: no Vaul drag handle on large screens — dismiss via × / backdrop / Escape.
  // handleOnly avoids content-drag swipe fighting the iframe. Top/bottom keep swipe chrome.
  const isSide = direction === 'left' || direction === 'right';
  return (
    <VaulDrawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
      dismissible={dismissible}
      handleOnly={handleOnly ?? isSide}
      {...props}
    />
  );
};
Drawer.displayName = 'Drawer';

const DrawerTrigger = VaulDrawer.Trigger;
DrawerTrigger.displayName = 'DrawerTrigger';

const DrawerPortal = VaulDrawer.Portal;
(DrawerPortal as unknown as { displayName: string }).displayName = 'DrawerPortal';

const DrawerOverlay = forwardRef<
  ComponentRef<typeof VaulDrawer.Overlay>,
  ComponentPropsWithoutRef<typeof VaulDrawer.Overlay> & {
    /** When false, pointer events pass through and overlay clicks do not dismiss. */
    closeOnClick?: boolean;
  }
>(({ className, closeOnClick = true, onClick, ...props }, ref) => (
  <VaulDrawer.Overlay
    ref={ref}
    data-drawer-overlay
    className={cn('fixed inset-0 bg-[var(--shellui-scrim)]', className)}
    style={{ zIndex: Z_INDEX.DRAWER_OVERLAY }}
    onClick={(e) => {
      if (!closeOnClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.(e);
    }}
    {...props}
  />
));
DrawerOverlay.displayName = VaulDrawer.Overlay.displayName;

/**
 * Floating panel: a gap away from the window edge on its outer sides (the offsets
 * include the safe area), all corners rounded, hairline border and soft shadow.
 */
const drawerPanel =
  'fixed flex flex-col overflow-clip border border-[var(--shellui-drawer-border)] bg-background rounded-[var(--shellui-drawer-radius)] shadow-[var(--shellui-drawer-shadow)]';

/** Base layout classes per direction. Max dimension is applied via style so size prop can override. */
const drawerContentByDirection: Record<DrawerDirection, string> = {
  bottom: `${drawerPanel} bottom-[var(--shellui-drawer-bottom)] left-[var(--shellui-drawer-left)] right-[var(--shellui-drawer-right)] h-auto max-md:rounded-[var(--shellui-sheet-radius)]`,
  top: `${drawerPanel} top-[var(--shellui-drawer-top)] left-[var(--shellui-drawer-left)] right-[var(--shellui-drawer-right)] h-auto`,
  left: `${drawerPanel} top-[var(--shellui-drawer-top)] bottom-[var(--shellui-drawer-bottom)] left-[var(--shellui-drawer-left)] h-auto w-auto`,
  right: `${drawerPanel} top-[var(--shellui-drawer-top)] bottom-[var(--shellui-drawer-bottom)] right-[var(--shellui-drawer-right)] h-auto w-auto`,
};

/** Free-edge resize handle (opposite the anchored side), 8px, inside the panel. */
const resizeHandleByDirection: Record<DrawerDirection, { className: string; cursor: string }> = {
  right: {
    className: 'absolute left-0 top-3 bottom-3 w-2',
    cursor: 'ew-resize',
  },
  left: {
    className: 'absolute right-0 top-3 bottom-3 w-2',
    cursor: 'ew-resize',
  },
  bottom: {
    className: 'absolute top-0 left-3 right-3 h-2',
    cursor: 'ns-resize',
  },
  top: {
    className: 'absolute bottom-0 left-3 right-3 h-2',
    cursor: 'ns-resize',
  },
};

function readDrawerOffsetPx(side: 'top' | 'right' | 'bottom' | 'left'): number {
  const px = readCssLengthPx(`var(--shellui-drawer-${side})`);
  return px > 0 ? px : FALLBACK_DRAWER_OFFSET_PX;
}

/** Largest panel size: the viewport minus the offsets on both ends of the size axis. */
function maxPrimarySize(direction: DrawerDirection): number {
  const isVertical = direction === 'top' || direction === 'bottom';
  const margin = isVertical
    ? readDrawerOffsetPx('top') + readDrawerOffsetPx('bottom')
    : readDrawerOffsetPx('left') + readDrawerOffsetPx('right');
  return Math.max(MIN_DRAWER_SIZE, (isVertical ? window.innerHeight : window.innerWidth) - margin);
}

function clampDrawerSize(px: number, direction: DrawerDirection): number {
  return Math.min(Math.max(px, MIN_DRAWER_SIZE), maxPrimarySize(direction));
}

interface DrawerContentProps extends Omit<
  ComponentPropsWithoutRef<typeof VaulDrawer.Content>,
  'direction'
> {
  direction?: DrawerDirection;
  /** CSS length: height for top/bottom (e.g. "80vh", "400px"), width for left/right (e.g. "50vw", "320px") */
  size?: string | null;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  /** When true (default), render the chrome close (×) control. */
  showCloseButton?: boolean;
  /** When true, render a native drag handle for swipe-to-dismiss. */
  showDragHandle?: boolean;
  /** Forwarded to overlay — when false, backdrop clicks do not close. */
  closeOnOverlayClick?: boolean;
  /**
   * When true (default), show a resize handle on the free edge (desktop).
   * Drawers are not movable.
   */
  resizable?: boolean;
  /** When the drawer opens, manual resize override is cleared. */
  open?: boolean;
}

const DrawerContent = forwardRef<ComponentRef<typeof VaulDrawer.Content>, DrawerContentProps>(
  (
    {
      className,
      direction = 'right',
      size,
      children,
      style,
      showCloseButton = true,
      showDragHandle = false,
      closeOnOverlayClick = true,
      resizable = true,
      open,
      ...props
    },
    ref,
  ) => {
    const pos: DrawerDirection = direction;
    const isVertical = pos === 'top' || pos === 'bottom';
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [overridePx, setOverridePx] = useState<number | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStart = useRef<{ pointer: number; size: number } | null>(null);
    const wasOpenRef = useRef(false);

    // Each open starts from the requested/default size — ignore prior manual resize
    useEffect(() => {
      const justOpened = open === true && !wasOpenRef.current;
      wasOpenRef.current = open === true;
      if (justOpened) {
        setOverridePx(null);
        resizeStart.current = null;
        setIsResizing(false);
      }
    }, [open]);

    // New size/direction from the open call → drop manual override
    useEffect(() => {
      setOverridePx(null);
    }, [size, direction]);

    // Keep resized drawer within the viewport when the browser shrinks
    useEffect(() => {
      if (overridePx === null) return;
      const onResize = () => {
        setOverridePx((prev) => (prev === null ? prev : clampDrawerSize(prev, pos)));
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [overridePx, pos]);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const beginResize = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!resizable) return;
        e.preventDefault();
        e.stopPropagation();
        const el = contentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const current = isVertical ? rect.height : rect.width;
        resizeStart.current = {
          pointer: isVertical ? e.clientY : e.clientX,
          size: overridePx ?? current,
        };
        setOverridePx(clampDrawerSize(overridePx ?? current, pos));
        setIsResizing(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [resizable, isVertical, overridePx, pos],
    );

    const onResizeMove = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        const start = resizeStart.current;
        if (!start) return;
        const pointer = isVertical ? e.clientY : e.clientX;
        const delta = pointer - start.pointer;
        // Dragging the free edge: right drawer grows when pointer moves left
        let next = start.size;
        if (pos === 'right') next = start.size - delta;
        else if (pos === 'left') next = start.size + delta;
        else if (pos === 'bottom') next = start.size - delta;
        else next = start.size + delta;
        setOverridePx(clampDrawerSize(next, pos));
      },
      [isVertical, pos],
    );

    const endResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeStart.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      resizeStart.current = null;
      setIsResizing(false);
    }, []);

    const effectiveSize =
      overridePx !== null
        ? `${overridePx}px`
        : size?.trim() || (isVertical ? 'calc(var(--shellui-overlay-max-height) * 0.8)' : '80vw');
    const sizeStyle: CSSProperties =
      overridePx !== null
        ? isVertical
          ? {
              height: effectiveSize,
              maxHeight: `min(${effectiveSize}, var(--shellui-drawer-max-height))`,
            }
          : {
              width: effectiveSize,
              maxWidth: `min(${effectiveSize}, var(--shellui-drawer-max-width))`,
            }
        : size === null
          ? isVertical
            ? { maxHeight: 'var(--shellui-drawer-max-height)' }
            : { maxWidth: 'min(90vw, var(--shellui-drawer-max-width))' }
          : isVertical
            ? {
                height: effectiveSize,
                maxHeight: `min(${effectiveSize}, var(--shellui-drawer-max-height))`,
              }
            : {
                width: effectiveSize,
                maxWidth: `min(${effectiveSize}, var(--shellui-drawer-max-width))`,
              };

    const resizeHandle = resizeHandleByDirection[pos];

    return (
      <DrawerPortal>
        <DrawerOverlay closeOnClick={closeOnOverlayClick} />
        <VaulDrawer.Content
          ref={setRefs}
          data-drawer-content
          data-drawer-direction={pos}
          data-drawer-resizing={isResizing ? 'true' : undefined}
          className={cn('outline-none', drawerContentByDirection[pos], className)}
          style={{
            backgroundColor: 'var(--background)',
            zIndex: Z_INDEX.DRAWER_CONTENT,
            ...(style?.transition === 'none' || isResizing
              ? { transition: 'none' }
              : {
                  transitionProperty: 'height, width, max-height, max-width',
                  transitionDuration: '200ms',
                  transitionTimingFunction: 'ease',
                }),
            ...sizeStyle,
            ...style,
          }}
          {...props}
        >
          {children}
          {/* Vaul drag handle only for top/bottom sheets — side panels use × / backdrop. */}
          {showDragHandle && isVertical && (
            <div
              data-drawer-handle-overlay
              className={cn(
                'pointer-events-none absolute inset-x-0 z-20 flex justify-center',
                pos === 'bottom' ? 'top-0 pt-1.5' : 'bottom-0 pb-1.5',
              )}
            >
              {/*
                Single visual pill — Vaul Handle already includes a 44px hitarea.
                Do not add an after: bar (that stacked on Vaul's default #e2e2e4 chrome).
              */}
              <DrawerHandle className="pointer-events-auto !mt-0" />
            </div>
          )}
          {showCloseButton && (
            <VaulDrawer.Close
              className="absolute right-4 top-4 z-30 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground cursor-pointer"
              aria-label="Close"
              onPointerDown={(e) => e.currentTarget.click()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </VaulDrawer.Close>
          )}
          {resizable && (
            <div
              data-drawer-resize-handle
              className={cn('z-20 touch-none', resizeHandle.className)}
              style={{ cursor: resizeHandle.cursor }}
              onPointerDown={beginResize}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              role="separator"
              aria-orientation={isVertical ? 'horizontal' : 'vertical'}
              aria-label="Resize drawer"
            />
          )}
        </VaulDrawer.Content>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = 'DrawerContent';

const DrawerClose = VaulDrawer.Close;
DrawerClose.displayName = 'DrawerClose';

const DrawerHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    data-drawer-header
    className={cn(
      'flex flex-col space-y-2 border-b border-border/60 px-6 pt-5 pb-4 text-left',
      className,
    )}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-auto flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end',
      className,
    )}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = forwardRef<
  ComponentRef<typeof VaulDrawer.Title>,
  ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DrawerTitle.displayName = VaulDrawer.Title.displayName;

const DrawerDescription = forwardRef<
  ComponentRef<typeof VaulDrawer.Description>,
  ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DrawerDescription.displayName = VaulDrawer.Description.displayName;

/** Theme-aware drag handle — uses Vaul Handle so swipe-to-dismiss works from the bar. */
const DrawerHandle = forwardRef<
  ComponentRef<typeof VaulDrawer.Handle>,
  ComponentPropsWithoutRef<typeof VaulDrawer.Handle>
>(({ className, style, ...props }, ref) => (
  <VaulDrawer.Handle
    ref={ref}
    data-drawer-handle
    className={cn(
      // Same pill as the More sheet handle: 36 x 5px, 6px from the top (Vaul adds the 44px hit area).
      'mx-auto mt-1.5 h-[5px] w-9 shrink-0 rounded-full !opacity-100',
      className,
    )}
    style={{
      // Inline wins over Vaul's injected `background: #e2e2e4`
      background: 'color-mix(in oklch, var(--foreground) 22%, transparent)',
      width: '36px',
      height: '5px',
      borderRadius: '9999px',
      ...style,
    }}
    {...props}
  />
));
DrawerHandle.displayName = 'DrawerHandle';

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerClose,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerHandle,
};
