import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ElementRef, ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/z-index';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

/** Radix Slottable expects a single React element child; wrap strings/fragments so Slot can clone. */
function ensureSingleElement(children: ReactNode): ReactNode {
  if (children == null) return null;
  if (typeof children === 'string' || typeof children === 'number') return <span>{children}</span>;
  if (Array.isArray(children)) return <span>{children}</span>;
  return children;
}

const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      data-tooltip-content
      className={cn(
        'overflow-visible rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
        className,
      )}
      style={{ zIndex: Z_INDEX.TOOLTIP }}
      {...props}
    >
      {ensureSingleElement(children)}
    </TooltipPrimitive.Content>
    {/* Arrow must be a sibling of Content (not inside), else Radix renders null */}
    <TooltipPrimitive.Arrow
      className="fill-popover stroke-border [stroke-width:1px]"
      width={10}
      height={5}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
