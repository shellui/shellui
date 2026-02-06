import {
  forwardRef,
  type ElementRef,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
} from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Z_INDEX } from "@/lib/z-index"
import { Button, type ButtonProps } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    data-dialog-overlay
    className={cn(
      "fixed inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-[1px]",
      className
    )}
    style={{ zIndex: Z_INDEX.ALERT_DIALOG_OVERLAY }}
    {...props}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const alertDialogContentVariants = cva(
  "fixed left-[50%] top-[50%] grid w-full min-w-0 max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background py-6 shadow-lg box-border overflow-hidden sm:rounded-lg",
  {
    variants: {
      size: {
        default: "max-w-lg",
        sm: "max-w-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface AlertDialogContentProps
  extends ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>,
    VariantProps<typeof alertDialogContentVariants> {}

const AlertDialogContent = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, size = "default", children, style, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      data-dialog-content
      className={cn(alertDialogContentVariants({ size }), "group", className)}
      data-size={size}
      style={{ zIndex: Z_INDEX.ALERT_DIALOG_CONTENT, ...style }}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col px-6 space-y-2 text-left group-data-[size=sm]:items-center group-data-[size=sm]:text-center",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogMedia = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-lg mb-4 [&>svg]:size-5",
      className
    )}
    {...props}
  />
)
AlertDialogMedia.displayName = "AlertDialogMedia"

const AlertDialogFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-full min-w-full flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      "-mb-6 mt-2 border-t border-border bg-muted/50 px-6 py-3 sm:rounded-b-lg",
      "[&_button]:h-8 [&_button]:text-xs [&_button]:px-3",
      "group-data-[size=sm]:flex-row group-data-[size=sm]:gap-2",
      "group-data-[size=sm]:[&>*:not(:only-child)]:min-w-0 group-data-[size=sm]:[&>*:not(:only-child)]:flex-1",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Action>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> &
    Pick<ButtonProps, "variant" | "size">
>(({ className, variant, size, ...props }, ref) => (
  <AlertDialogPrimitive.Action asChild>
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      {...props}
    />
  </AlertDialogPrimitive.Action>
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Cancel>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> &
    Pick<ButtonProps, "variant" | "size">
>(({ className, variant, size, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel asChild>
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      {...props}
    />
  </AlertDialogPrimitive.Cancel>
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
