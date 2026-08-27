'use client';

import {
  forwardRef,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/z-index';

export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

const Drawer = ({
  open,
  onOpenChange,
  direction = 'right',
  dismissible = true,
  ...props
}: ComponentProps<typeof VaulDrawer.Root> & {
  direction?: DrawerDirection;
}) => (
  <VaulDrawer.Root
    open={open}
    onOpenChange={onOpenChange}
    direction={direction}
    dismissible={dismissible}
    {...props}
  />
);
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
    className={cn('fixed inset-0 bg-black/50 backdrop-blur-[1px]', className)}
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

/** Base layout classes per direction — max dimension is applied via style so size prop can override. */
const drawerContentByDirection: Record<DrawerDirection, string> = {
  bottom:
    'fixed inset-x-0 bottom-0 mt-24 flex h-auto flex-col rounded-t-xl border border-border bg-background',
  top: 'fixed inset-x-0 top-0 mb-24 flex h-auto flex-col rounded-b-xl border border-border bg-background',
  left: 'fixed inset-y-0 left-0 mr-24 flex h-full w-auto flex-col rounded-r-xl border border-border bg-background',
  right:
    'fixed inset-y-0 right-0 ml-24 flex h-full w-auto flex-col rounded-l-xl border border-border bg-background',
};

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
      ...props
    },
    ref,
  ) => {
    const pos: DrawerDirection = direction;
    const isVertical = pos === 'top' || pos === 'bottom';
    // Set dimension via inline style; use both width/height and max so Vaul/defaults don't override.
    const effectiveSize = size?.trim() || (isVertical ? '80dvh' : '80vw');
    const sizeStyle: CSSProperties =
      size === null
        ? isVertical
          ? { maxHeight: 'min(90dvh, 100dvh)' }
          : { maxWidth: 'min(90vw, 100%)' }
        : isVertical
          ? { height: effectiveSize, maxHeight: `min(${effectiveSize}, 100dvh)` }
          : { width: effectiveSize, maxWidth: `min(${effectiveSize}, 100%)` };

    const handlePositionClass =
      pos === 'bottom'
        ? 'mx-auto mt-3 mb-1'
        : pos === 'top'
          ? 'mx-auto mb-3 mt-1 order-last'
          : pos === 'left'
            ? 'my-auto ml-auto mr-2 h-[100px] w-1.5 absolute right-2 top-1/2 -translate-y-1/2'
            : 'my-auto mr-auto ml-2 h-[100px] w-1.5 absolute left-2 top-1/2 -translate-y-1/2';

    return (
      <DrawerPortal>
        <DrawerOverlay closeOnClick={closeOnOverlayClick} />
        <VaulDrawer.Content
          ref={ref}
          data-drawer-content
          data-drawer-direction={pos}
          className={cn('outline-none', drawerContentByDirection[pos], className)}
          style={{
            backgroundColor: 'var(--background)',
            zIndex: Z_INDEX.DRAWER_CONTENT,
            transitionProperty: 'height, width, max-height, max-width',
            transitionDuration: '200ms',
            transitionTimingFunction: 'ease',
            ...sizeStyle,
            ...style,
          }}
          {...props}
        >
          {showDragHandle && (
            <DrawerHandle
              className={cn(isVertical ? undefined : 'rounded-full', handlePositionClass)}
            />
          )}
          {children}
          {showCloseButton && (
            <VaulDrawer.Close
              className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground cursor-pointer"
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
>(({ className, ...props }, ref) => (
  <VaulDrawer.Handle
    ref={ref}
    data-drawer-handle
    className={cn(
      'mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/40',
      className,
    )}
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
