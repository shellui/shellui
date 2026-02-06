import {
  forwardRef,
  Children,
  isValidElement,
  cloneElement,
  type HTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/utils';

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('inline-flex rounded-md', className)}
        role="group"
        {...props}
      >
        {Children.map(children, (child, index) => {
          if (isValidElement(child)) {
            const isFirst = index === 0;
            const isLast = index === Children.count(children) - 1;

            return cloneElement(child as ReactElement<Record<string, unknown>>, {
              className: cn(
                // Remove rounded corners from all buttons
                'rounded-none',
                // First button: rounded left only (uses theme radius)
                isFirst && 'rounded-l-md',
                // Last button: rounded right only (uses theme radius)
                isLast && 'rounded-r-md',
                // Remove left border from all except first, using theme border color
                !isFirst && 'border-l-0 -ml-px',
                (child as ReactElement<{ className?: string }>).props.className,
              ),
            });
          }
          return child;
        })}
      </div>
    );
  },
);
ButtonGroup.displayName = 'ButtonGroup';

export { ButtonGroup };
