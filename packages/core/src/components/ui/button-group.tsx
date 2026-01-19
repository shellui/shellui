import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex rounded-md shadow-sm",
          className
        )}
        role="group"
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            const isFirst = index === 0
            const isLast = index === React.Children.count(children) - 1
            
            return React.cloneElement(child as React.ReactElement<any>, {
              className: cn(
                // Remove rounded corners from all buttons
                "rounded-none",
                // First button: rounded left only
                isFirst && "rounded-l-md",
                // Last button: rounded right only
                isLast && "rounded-r-md",
                // Remove left border from all except first
                !isFirst && "border-l-0 -ml-px",
                // Remove shadow from all except first
                !isFirst && "shadow-none",
                child.props.className
              ),
            })
          }
          return child
        })}
      </div>
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup }
