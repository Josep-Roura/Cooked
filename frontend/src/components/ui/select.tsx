import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isInvalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, isInvalid, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isInvalid
            ? "border-error focus-visible:ring-error"
            : "border-border",
          className
        )}
        aria-invalid={isInvalid ? "true" : "false"}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
