import {
  useCallback,
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
  children: ReactNode;
}

/**
 * Single Radix Dialog host for `openModal`.
 * Presentation morphs between centered dialog and bottom sheet via CSS —
 * children (iframe) stay mounted across breakpoint changes.
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
  children,
}: ResponsiveModalProps) {
  const isSheet = presentation === 'sheet';
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetDrag = useCallback(() => {
    dragStartY.current = null;
    dragCurrentY.current = 0;
    setDragOffset(0);
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isSheet || !dismissible) return;
      dragStartY.current = e.clientY;
      dragCurrentY.current = 0;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isSheet, dismissible],
  );

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    dragCurrentY.current = delta;
    setDragOffset(delta);
  }, []);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if capture already released
      }
      const delta = dragCurrentY.current;
      const height = contentRef.current?.offsetHeight ?? window.innerHeight;
      const shouldDismiss = delta >= SWIPE_DISMISS_PX || delta >= height * SWIPE_DISMISS_RATIO;
      resetDrag();
      if (shouldDismiss && dismissible) {
        onOpenChange(false);
      }
    },
    [dismissible, onOpenChange, resetDrag],
  );

  const sheetTransform = isSheet && dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined;

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
        showCloseButton={showCloseButton}
        className={cn(
          // Neutralize DialogContent defaults; presentation CSS / classes own layout.
          'gap-0 p-0 overflow-hidden flex flex-col',
          isSheet
            ? 'left-0 right-0 top-auto bottom-0 max-w-none w-full translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border-x-0 border-b-0'
            : 'rounded-lg',
          className,
        )}
        style={{
          ...style,
          ...(sheetTransform
            ? { transform: sheetTransform, transition: isDragging ? 'none' : style?.transition }
            : {}),
          ...(isDragging ? { transition: 'none' } : {}),
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

        {isSheet && showDragHandle && dismissible && (
          <div
            data-responsive-modal-handle
            className="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={resetDrag}
            role="presentation"
          >
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
