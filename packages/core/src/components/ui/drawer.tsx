'use client';

import * as React from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';

export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

const Drawer = ({
  open,
  onOpenChange,
  direction = 'right',
  ...props
}: React.ComponentProps<typeof VaulDrawer.Root> & {
  direction?: DrawerDirection;
}) => (
  <VaulDrawer.Root
    open={open}
    onOpenChange={onOpenChange}
    direction={direction}
    {...props}
  />
);
Drawer.displayName = 'Drawer';

const DrawerTrigger = VaulDrawer.Trigger;
DrawerTrigger.displayName = 'DrawerTrigger';

const DrawerPortal = VaulDrawer.Portal;
DrawerPortal.displayName = 'DrawerPortal';

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof VaulDrawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Overlay>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Overlay
    ref={ref}
    data-drawer-overlay
    className={cn(
      'fixed inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-[1px]',
      className
    )}
    style={{ zIndex: Z_INDEX.DRAWER_OVERLAY }}
    {...props}
  />
));
DrawerOverlay.displayName = VaulDrawer.Overlay.displayName;

const drawerContentByDirection: Record<
  DrawerDirection,
  string
> = {
  bottom:
    'fixed inset-x-0 bottom-0 mt-24 flex h-auto max-h-[96vh] flex-col rounded-t-[10px] border border-border bg-background',
  top:
    'fixed inset-x-0 top-0 mb-24 flex h-auto max-h-[96vh] flex-col rounded-b-[10px] border border-border bg-background',
  left:
    'fixed inset-y-0 left-0 mr-24 flex h-full w-auto max-w-[96vw] flex-col rounded-r-[10px] border border-border bg-background',
  right:
    'fixed inset-y-0 right-0 ml-24 flex h-full w-auto max-w-[96vw] flex-col rounded-l-[10px] border border-border bg-background',
};

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> {
  direction?: DrawerDirection;
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof VaulDrawer.Content>,
  DrawerContentProps
>(({ className, direction = 'right', children, ...props }, ref) => {
  const pos: DrawerDirection = direction;
  return (
  <DrawerPortal>
    <DrawerOverlay />
    <VaulDrawer.Content
      ref={ref}
      data-drawer-content
      className={cn(
        'outline-none',
        drawerContentByDirection[pos],
        className
      )}
      style={{
        backgroundColor: 'hsl(var(--background))',
        zIndex: Z_INDEX.DRAWER_CONTENT,
      }}
      {...props}
    >
      {children}
    </VaulDrawer.Content>
  </DrawerPortal>
  );
});
DrawerContent.displayName = 'DrawerContent';

const DrawerClose = VaulDrawer.Close;
DrawerClose.displayName = 'DrawerClose';

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-drawer-header
    className={cn(
      'flex flex-col space-y-2 border-b border-border/60 px-6 pt-5 pb-4 text-left',
      className
    )}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-auto flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof VaulDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DrawerTitle.displayName = VaulDrawer.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof VaulDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DrawerDescription.displayName = VaulDrawer.Description.displayName;

const DrawerHandle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-drawer-handle
    className={cn('mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted', className)}
    {...props}
  />
);
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
