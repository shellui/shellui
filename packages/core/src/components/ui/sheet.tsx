import {
  forwardRef,
  useCallback,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/z-index';

const PORTALED_OVERLAY_SELECTOR =
  '[data-dropdown-menu-content], [data-auth-menu-content], [data-sonner-toaster], [data-upload-toast]';

function isPortaledOverlayTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : (target as Node | null)?.parentElement;
  if (!element) return false;
  return Boolean(element.closest(PORTALED_OVERLAY_SELECTOR));
}

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = forwardRef<
  ElementRef<typeof SheetPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    data-sheet-overlay=""
    className={cn('fixed inset-0 bg-black/50 backdrop-blur-[1px]', className)}
    style={{ zIndex: Z_INDEX.SIDEBAR_SHEET_OVERLAY, ...style }}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva('fixed flex flex-col gap-4 bg-background shadow-lg', {
  variants: {
    side: {
      top: 'inset-x-0 top-0 border-b',
      bottom: 'inset-x-0 bottom-0 border-t',
      left: 'inset-y-0 left-0 h-full w-3/4 max-w-full border-r sm:max-w-sm',
      right: 'inset-y-0 right-0 h-full w-3/4 max-w-full border-l sm:max-w-sm',
    },
  },
  defaultVariants: {
    side: 'right',
  },
});

interface SheetContentProps
  extends
    ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  overlayZIndex?: number;
  contentZIndex?: number;
}

const SheetContent = forwardRef<ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  (
    {
      side = 'right',
      className,
      children,
      style,
      overlayZIndex,
      contentZIndex,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    const handlePointerDownOutside = useCallback(
      (
        event: Parameters<
          NonNullable<ComponentProps<typeof SheetPrimitive.Content>['onPointerDownOutside']>
        >[0],
      ) => {
        if (isPortaledOverlayTarget(event.target)) {
          event.preventDefault();
        }
        onPointerDownOutside?.(event);
      },
      [onPointerDownOutside],
    );

    const handleFocusOutside = useCallback(
      (
        event: Parameters<
          NonNullable<ComponentProps<typeof SheetPrimitive.Content>['onFocusOutside']>
        >[0],
      ) => {
        if (isPortaledOverlayTarget(event.target)) {
          event.preventDefault();
        }
        onFocusOutside?.(event);
      },
      [onFocusOutside],
    );

    const handleInteractOutside = useCallback(
      (
        event: Parameters<
          NonNullable<ComponentProps<typeof SheetPrimitive.Content>['onInteractOutside']>
        >[0],
      ) => {
        if (isPortaledOverlayTarget(event.target)) {
          event.preventDefault();
        }
        onInteractOutside?.(event);
      },
      [onInteractOutside],
    );

    return (
      <SheetPortal>
        <SheetOverlay style={overlayZIndex !== undefined ? { zIndex: overlayZIndex } : undefined} />
        <SheetPrimitive.Content
          ref={ref}
          data-sheet-content=""
          data-side={side}
          className={cn(sheetVariants({ side }), className)}
          style={{
            zIndex: contentZIndex ?? Z_INDEX.SIDEBAR_SHEET_CONTENT,
            ...style,
          }}
          onPointerDownOutside={handlePointerDownOutside}
          onFocusOutside={handleFocusOutside}
          onInteractOutside={handleInteractOutside}
          {...props}
        >
          {children}
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary cursor-pointer">
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
              className="size-4"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = forwardRef<
  ElementRef<typeof SheetPrimitive.Title>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = forwardRef<
  ElementRef<typeof SheetPrimitive.Description>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
