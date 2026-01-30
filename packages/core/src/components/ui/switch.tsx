import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked)
    }

    return (
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
        <div
          className={cn(
            "relative w-11 h-6 rounded-full border border-border transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
            checked ? "bg-primary" : "bg-muted",
            className
          )}
        >
          <div
            className={cn(
              "absolute top-[1px] left-[1px] h-5 w-5 bg-background border border-border rounded-full transition-transform",
              checked ? "translate-x-5" : "translate-x-0"
            )}
          />
        </div>
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
