import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, isInvalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition-colors",
          "placeholder:text-[var(--text-secondary)]",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isInvalid
            ? "border-error focus-visible:ring-error"
            : "border-border",
          className
        )}
        aria-invalid={isInvalid ? "true" : "false"}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
