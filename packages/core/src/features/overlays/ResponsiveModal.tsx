import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { cn } from '../../lib/utils';

export type ResponsiveModalPresentation = 'dialog' | 'sheet';

const SWIPE_DISMISS_PX = 80;
const SWIPE_DISMISS_RATIO = 0.2;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type ModalGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: ResponsiveModalPresentation;
  /** Size / layout classes for the active presentation. */
  className?: string;
  style?: CSSProperties;
  title: string;
  description?: string;
  showCloseButton?: boolean;
  dismissible?: boolean;
  closeOnOverlayClick?: boolean;
  /** Show drag handle in sheet mode when dismissible. */
  showDragHandle?: boolean;
  /** Desktop dialog: drag by title bar. Default true. */
  movable?: boolean;
  /** Desktop dialog: resize from edges/corners. Default true. */
  resizable?: boolean;
  children: ReactNode;
}

function clampGeometry(geo: ModalGeometry): ModalGeometry {
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - VIEWPORT_MARGIN * 2);
  const width = Math.min(Math.max(geo.width, MIN_WIDTH), maxW);
  const height = Math.min(Math.max(geo.height, MIN_HEIGHT), maxH);
  const x = Math.min(
    Math.max(geo.x, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
  );
  const y = Math.min(
    Math.max(geo.y, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
  );
  return { x, y, width, height };
}

/** Shrink to viewport and re-center — used on browser resize so the modal is never cut off. */
function fitGeometryToViewport(geo: ModalGeometry): ModalGeometry {
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - VIEWPORT_MARGIN * 2);
  const width = Math.min(Math.max(geo.width, MIN_WIDTH), maxW);
  const height = Math.min(Math.max(geo.height, MIN_HEIGHT), maxH);
  const x = Math.max(VIEWPORT_MARGIN, (window.innerWidth - width) / 2);
  const y = Math.max(VIEWPORT_MARGIN, (window.innerHeight - height) / 2);
  return { x, y, width, height };
}

/** Match responsive-modal-fade-out so geometry survives the close animation. */
const CLOSE_GEOMETRY_CLEAR_MS = 250;

const RESIZE_HANDLES: { edge: ResizeEdge; className: string; cursor: string }[] = [
  // Top edge is reserved for move (see move handle below), not north-resize
  { edge: 's', className: 'left-3 right-3 bottom-0 h-1.5 translate-y-1/2', cursor: 'ns-resize' },
  { edge: 'e', className: 'top-3 bottom-3 right-0 w-1.5 translate-x-1/2', cursor: 'ew-resize' },
  { edge: 'w', className: 'top-3 bottom-3 left-0 w-1.5 -translate-x-1/2', cursor: 'ew-resize' },
  {
    edge: 'ne',
    className: 'right-0 top-0 h-3 w-3 translate-x-1/2 -translate-y-1/2',
    cursor: 'nesw-resize',
  },
  {
    edge: 'nw',
    className: 'left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2',
    cursor: 'nwse-resize',
  },
  {
    edge: 'se',
    className: 'right-0 bottom-0 h-3 w-3 translate-x-1/2 translate-y-1/2',
    cursor: 'nwse-resize',
  },
  {
    edge: 'sw',
    className: 'left-0 bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/2',
    cursor: 'nesw-resize',
  },
];

/**
 * Single Radix Dialog host for `openModal`.
 * Presentation morphs between centered dialog and bottom sheet via CSS —
 * children (iframe) stay mounted across breakpoint changes.
 * Dialog mode is movable/resizable by default.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  presentation,
  className,
  style,
  title,
  description,
  showCloseButton = true,
  dismissible = true,
  closeOnOverlayClick = true,
  showDragHandle = true,
  movable = true,
  resizable = true,
  children,
}: ResponsiveModalProps) {
  const isSheet = presentation === 'sheet';
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const [geometry, setGeometry] = useState<ModalGeometry | null>(null);
  const geometryRef = useRef<ModalGeometry | null>(null);
  const dialogGeometryCache = useRef<ModalGeometry | null>(null);
  const interactStart = useRef<{
    pointerX: number;
    pointerY: number;
    geo: ModalGeometry;
    edge?: ResizeEdge;
  } | null>(null);
  const [isWindowInteracting, setIsWindowInteracting] = useState(false);

  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  // Keep custom geometry through the close animation; clear after it finishes
  // so the next open starts centered (no snap-back mid-exit).
  useEffect(() => {
    if (open) {
      // Fresh open — always start from default centered layout
      setGeometry(null);
      dialogGeometryCache.current = null;
      interactStart.current = null;
      setIsWindowInteracting(false);
      return;
    }
    interactStart.current = null;
    setIsWindowInteracting(false);
    const t = window.setTimeout(() => {
      setGeometry(null);
      dialogGeometryCache.current = null;
    }, CLOSE_GEOMETRY_CLEAR_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Browser resize: never leave a custom-sized modal larger than the viewport.
  // Re-center so it isn't cut off at the edges.
  useEffect(() => {
    if (!open || isSheet) return;

    const fitToWindow = () => {
      const current = geometryRef.current;
      if (current) {
        const next = fitGeometryToViewport(current);
        setGeometry(next);
        dialogGeometryCache.current = next;
        return;
      }
      // Default (centered) layout — if it overflows after a shrink, lock to fitted geometry
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxW = window.innerWidth - VIEWPORT_MARGIN * 2;
      const maxH = window.innerHeight - VIEWPORT_MARGIN * 2;
      if (rect.width > maxW + 1 || rect.height > maxH + 1) {
        const next = fitGeometryToViewport({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        setGeometry(next);
        dialogGeometryCache.current = next;
      }
    };

    window.addEventListener('resize', fitToWindow);
    return () => window.removeEventListener('resize', fitToWindow);
  }, [open, isSheet]);

  // Sheet ignores custom geometry; restore cached dialog geometry when returning to dialog
  useEffect(() => {
    if (isSheet) {
      if (geometryRef.current) {
        dialogGeometryCache.current = geometryRef.current;
      }
      setGeometry(null);
      return;
    }
    if (dialogGeometryCache.current) {
      setGeometry(fitGeometryToViewport(dialogGeometryCache.current));
    }
  }, [isSheet]);

  const captureCurrentGeometry = useCallback((): ModalGeometry | null => {
    const el = contentRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return clampGeometry({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const beginWindowInteract = useCallback(
    (e: ReactPointerEvent, edge?: ResizeEdge) => {
      if (isSheet) return;
      e.preventDefault();
      e.stopPropagation();
      const base = geometryRef.current ?? captureCurrentGeometry();
      if (!base) return;
      interactStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        geo: base,
        edge,
      };
      setGeometry(base);
      setIsWindowInteracting(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [captureCurrentGeometry, isSheet],
  );

  const onWindowPointerMove = useCallback((e: ReactPointerEvent) => {
    const start = interactStart.current;
    if (!start) return;
    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;
    const { geo, edge } = start;

    if (!edge) {
      // Move
      setGeometry(clampGeometry({ ...geo, x: geo.x + dx, y: geo.y + dy }));
      return;
    }

    let { x, y, width, height } = geo;
    if (edge.includes('e')) width = geo.width + dx;
    if (edge.includes('w')) {
      width = geo.width - dx;
      x = geo.x + dx;
    }
    if (edge.includes('s')) height = geo.height + dy;
    if (edge.includes('n')) {
      height = geo.height - dy;
      y = geo.y + dy;
    }

    // Keep opposite edge fixed when hitting min size
    if (edge.includes('w') && width < MIN_WIDTH) {
      x = geo.x + geo.width - MIN_WIDTH;
      width = MIN_WIDTH;
    }
    if (edge.includes('n') && height < MIN_HEIGHT) {
      y = geo.y + geo.height - MIN_HEIGHT;
      height = MIN_HEIGHT;
    }

    const next = clampGeometry({ x, y, width, height });
    setGeometry(next);
  }, []);

  const endWindowInteract = useCallback((e: ReactPointerEvent) => {
    if (!interactStart.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    interactStart.current = null;
    setIsWindowInteracting(false);
    if (geometryRef.current) {
      dialogGeometryCache.current = geometryRef.current;
    }
  }, []);

  const resetSheetDrag = useCallback(() => {
    dragStartY.current = null;
    dragCurrentY.current = 0;
    setSheetDragOffset(0);
    setIsSheetDragging(false);
  }, []);

  const handleSheetPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isSheet || !dismissible) return;
      dragStartY.current = e.clientY;
      dragCurrentY.current = 0;
      setIsSheetDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isSheet, dismissible],
  );

  const handleSheetPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    dragCurrentY.current = delta;
    setSheetDragOffset(delta);
  }, []);

  const handleSheetPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const delta = dragCurrentY.current;
      const height = contentRef.current?.offsetHeight ?? window.innerHeight;
      const shouldDismiss = delta >= SWIPE_DISMISS_PX || delta >= height * SWIPE_DISMISS_RATIO;
      resetSheetDrag();
      if (shouldDismiss && dismissible) {
        onOpenChange(false);
      }
    },
    [dismissible, onOpenChange, resetSheetDrag],
  );

  const canMove = movable && !isSheet;
  const canResize = resizable && !isSheet;
  const hasCustomGeometry = !isSheet && geometry !== null;

  const sheetTransform =
    isSheet && sheetDragOffset > 0 ? `translateY(${sheetDragOffset}px)` : undefined;

  const geometryStyle: CSSProperties | undefined = hasCustomGeometry
    ? {
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        maxWidth: 'none',
        maxHeight: 'none',
        transform: 'none',
        right: 'auto',
        bottom: 'auto',
      }
    : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        ref={(node) => {
          contentRef.current = node;
        }}
        data-presentation={presentation}
        data-geometry={hasCustomGeometry ? 'custom' : 'auto'}
        data-window-interacting={isWindowInteracting ? 'true' : undefined}
        showCloseButton={showCloseButton}
        className={cn(
          'gap-0 p-0 overflow-hidden flex flex-col',
          isSheet
            ? 'left-0 right-0 top-auto bottom-0 max-w-none w-full translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border-x-0 border-b-0'
            : cn('rounded-lg', hasCustomGeometry && 'translate-x-0 translate-y-0 max-w-none'),
          className,
        )}
        style={{
          ...style,
          ...geometryStyle,
          ...(sheetTransform
            ? {
                transform: sheetTransform,
                transition: isSheetDragging ? 'none' : style?.transition,
              }
            : {}),
          ...((isSheetDragging || isWindowInteracting) && { transition: 'none' }),
        }}
        onPointerDownOutside={(e) => {
          if (!closeOnOverlayClick || !dismissible) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!dismissible) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (!closeOnOverlayClick || !dismissible) {
            e.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">{description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{title}</DialogDescription>
        )}

        {canMove && (
          <div
            data-responsive-modal-titlebar
            className={cn(
              // Invisible hit target on the top border only — sits mostly outside content
              // so buttons/iframe controls underneath stay clickable (pointer-events none on the
              // content side). Use grab cursor when hovering the edge.
              'pointer-events-none absolute inset-x-0 top-0 z-10 h-7',
            )}
            aria-hidden
          >
            {/* Narrow edge strip re-enables hit-testing for drag without covering content */}
            <div
              className="pointer-events-auto absolute inset-x-3 top-0 h-2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={(e) => beginWindowInteract(e)}
              onPointerMove={onWindowPointerMove}
              onPointerUp={endWindowInteract}
              onPointerCancel={endWindowInteract}
              role="presentation"
              aria-label="Move modal"
            />
          </div>
        )}

        {isSheet && showDragHandle && dismissible && (
          <div
            data-responsive-modal-handle
            className="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={resetSheetDrag}
            role="presentation"
          >
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

        {canResize &&
          RESIZE_HANDLES.map(({ edge, className: handleClass, cursor }) => (
            <div
              key={edge}
              data-resize-handle={edge}
              className={cn('absolute z-20 touch-none', handleClass)}
              style={{ cursor }}
              onPointerDown={(e) => beginWindowInteract(e, edge)}
              onPointerMove={onWindowPointerMove}
              onPointerUp={endWindowInteract}
              onPointerCancel={endWindowInteract}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
