import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './sheet';
import { Z_INDEX } from '../../lib/z-index';
import { cn } from '../../lib/utils';
import {
  clampMobileSidebarDragHeight,
  resolveMobileSidebarHeightCss,
  resolveMobileSidebarHeightPx,
  snapMobileSidebarHeight,
  type MobileSidebarSize,
} from '../../lib/mobile-sidebar-size';

/** Keep dismiss translate through the sheet exit animation (~180ms CSS). */
const CLOSE_CLEAR_MS = 220;

function readOverlayMaxHeightPx(): number {
  if (typeof window === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--shellui-overlay-max-height')
    .trim();
  if (raw) {
    // Prefer measuring a temporary element so calc() resolves correctly.
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;height:var(--shellui-overlay-max-height)';
    document.documentElement.appendChild(probe);
    const measured = probe.getBoundingClientRect().height;
    probe.remove();
    if (Number.isFinite(measured) && measured > 0) return measured;
  }
  // Fallback: match index.css overlay max (app height − safe top − 0.5rem).
  const appH =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--shellui-app-height'),
    ) || window.innerHeight;
  const safeTop =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--shellui-safe-area-top'),
    ) || 0;
  return Math.max(0, appH - safeTop - 8);
}

export interface MobileSidebarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size: MobileSidebarSize;
  onSizeChange: (size: MobileSidebarSize) => void;
  children: ReactNode;
}

/**
 * Mobile navigation as a bottom sheet: sm/md/lg snap sizes, drag resize,
 * overlay dismiss, and drag-down close. Slides up from off-screen on open.
 */
export function MobileSidebarSheet({
  open,
  onOpenChange,
  size,
  onSizeChange,
  children,
}: MobileSidebarSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSize, setActiveSize] = useState(size);
  const dragStart = useRef<{ pointerY: number; heightPx: number } | null>(null);
  const liveHeightRef = useRef<number | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    setActiveSize(size);
  }, [size]);

  // Fresh open: clear mid-dismiss / mid-drag state so enter animation starts clean.
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      dragStart.current = null;
      liveHeightRef.current = null;
      setActiveSize(size);
      setDragHeightPx(null);
      setDragOffsetY(0);
      setIsDragging(false);
    }
  }, [open, size]);

  // Clear dismiss translate after exit animation finishes.
  useEffect(() => {
    if (open) return;
    if (dragOffsetY === 0 && dragHeightPx === null) return;
    const id = window.setTimeout(() => {
      setDragOffsetY(0);
      setDragHeightPx(null);
    }, CLOSE_CLEAR_MS);
    return () => window.clearTimeout(id);
  }, [open, dragOffsetY, dragHeightPx]);

  const beginDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!open || closingRef.current) return;
      e.preventDefault();
      const maxH = readOverlayMaxHeightPx();
      const current =
        liveHeightRef.current ??
        contentRef.current?.getBoundingClientRect().height ??
        resolveMobileSidebarHeightPx(activeSize, maxH);
      dragStart.current = { pointerY: e.clientY, heightPx: current };
      liveHeightRef.current = current;
      setIsDragging(true);
      setDragHeightPx(current);
      setDragOffsetY(0);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [open, activeSize],
  );

  const onDragMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const maxH = readOverlayMaxHeightPx();
    // Finger down → shorter sheet (bottom-anchored).
    const next = clampMobileSidebarDragHeight(start.heightPx - (e.clientY - start.pointerY), maxH);
    liveHeightRef.current = next;
    setDragHeightPx(next);
  }, []);

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragStart.current = null;
      setIsDragging(false);

      const maxH = readOverlayMaxHeightPx();
      const live = liveHeightRef.current ?? resolveMobileSidebarHeightPx(activeSize, maxH);
      const snap = snapMobileSidebarHeight(live, maxH);

      if (snap === 'close') {
        closingRef.current = true;
        // Keep current height and slide the rest of the way off-screen.
        const height = contentRef.current?.offsetHeight ?? live;
        setDragOffsetY(Math.max(height, live));
        onOpenChange(false);
        return;
      }

      liveHeightRef.current = null;
      setActiveSize(snap);
      setDragHeightPx(null);
      setDragOffsetY(0);
      if (snap !== size) onSizeChange(snap);
    },
    [activeSize, size, onOpenChange, onSizeChange],
  );

  const cancelDrag = useCallback(() => {
    dragStart.current = null;
    liveHeightRef.current = null;
    setIsDragging(false);
    setDragHeightPx(null);
    setDragOffsetY(0);
  }, []);

  const heightCss = resolveMobileSidebarHeightCss(activeSize);
  const sheetStyle: CSSProperties = {
    zIndex: Z_INDEX.SIDEBAR_SHEET_CONTENT,
    height: dragHeightPx !== null ? `${dragHeightPx}px` : heightCss,
    maxHeight: 'var(--shellui-overlay-max-height)',
    ...(isDragging || dragOffsetY > 0
      ? {
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), height 0.2s ease',
        }
      : dragHeightPx !== null
        ? { transition: 'height 0.2s ease' }
        : {}),
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closingRef.current = true;
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        ref={(node) => {
          contentRef.current = node;
        }}
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        data-mobile-sidebar-size={activeSize}
        data-mobile-sidebar-dragging={isDragging ? 'true' : undefined}
        data-mobile-sidebar-dismissing={dragOffsetY > 0 && !isDragging ? 'true' : undefined}
        side="bottom"
        overlayZIndex={Z_INDEX.SIDEBAR_SHEET_OVERLAY}
        className={cn(
          'gap-0 overflow-hidden rounded-t-xl border-x-0 border-b-0 bg-sidebar p-0 text-sidebar-foreground',
          'w-full max-w-none sm:max-w-none [&>button]:hidden',
        )}
        style={sheetStyle}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>

        {/* Grab handle — resize between sm/md/lg; pull past sm to close. */}
        <div
          data-mobile-sidebar-handle=""
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex touch-none items-start justify-center"
          role="presentation"
        >
          <div
            className="pointer-events-auto relative h-11 w-28 shrink-0 cursor-grab touch-none select-none active:cursor-grabbing after:absolute after:left-1/2 after:top-1.5 after:h-[3px] after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-muted-foreground/70 after:content-['']"
            aria-label="Resize sidebar"
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={beginDrag}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
          />
        </div>

        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden pt-3 pr-[var(--shellui-safe-area-right)] pb-[var(--shellui-safe-area-bottom)] pl-[var(--shellui-safe-area-left)]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
