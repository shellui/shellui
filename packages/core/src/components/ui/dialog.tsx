import {
  forwardRef,
  useCallback,
  Children,
  type ElementRef,
  type ComponentPropsWithoutRef,
  type ComponentProps,
  type HTMLAttributes,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-dialog-overlay
    className={cn('fixed inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-[1px]', className)}
    style={{ zIndex: Z_INDEX.MODAL_OVERLAY }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** When true, the default close (X) button is not rendered. Escape and overlay still close. */
  hideCloseButton?: boolean;
}

const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, onPointerDownOutside, hideCloseButton, ...props }, ref) => {
    const hasContent = Children.count(children) > 2;

    const handlePointerDownOutside = useCallback(
      (
        event: Parameters<
          NonNullable<ComponentProps<typeof DialogPrimitive.Content>['onPointerDownOutside']>
        >[0],
      ) => {
        const target = event?.target as Element | null;
        if (target?.closest?.('[data-sonner-toaster]')) {
          event.preventDefault();
        }
        onPointerDownOutside?.(event);
      },
      [onPointerDownOutside],
    );

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          data-dialog-content
          data-has-content={hasContent}
          className={cn(
            'fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 border bg-background px-6 pt-0 pb-0 shadow-lg sm:rounded-lg',
            'data-[has-content=false]:gap-0 data-[has-content=false]:[&>[data-dialog-header]]:border-b-0 data-[has-content=false]:[&>[data-dialog-header]]:pb-0',
            className,
          )}
          style={{ backgroundColor: 'hsl(var(--background))', zIndex: Z_INDEX.MODAL_CONTENT }}
          onPointerDownOutside={handlePointerDownOutside}
          {...props}
        >
          {children}
          {!hideCloseButton && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground cursor-pointer">
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
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-header
    className={cn(
      '-mx-6 flex flex-col space-y-2.5 border-b border-border/60 px-6 pt-5 pb-4 text-left',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      '-mx-6 mt-4 flex flex-col-reverse gap-2 rounded-b-lg border-t border-border bg-sidebar-background px-6 py-2 text-sidebar-foreground sm:flex-row sm:justify-end sm:space-x-2 [&_button]:h-8 [&_button]:px-3 [&_button]:text-xs',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
