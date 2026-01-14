import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isInvalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, isInvalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[80px] rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition-colors resize-none",
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

Textarea.displayName = "Textarea";
