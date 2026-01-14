"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "solid",
      size = "md",
      isLoading,
      disabled,
      children,
      ...rest
    },
    ref
  ) {
    const base =
      "relative inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      solid:
        "border-border bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]",
      ghost:
        "border-transparent bg-transparent hover:bg-black/5 text-[var(--text-primary)] dark:hover:bg-white/10"
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "text-xs px-2 py-1 h-auto",
      md: "text-sm px-4 py-2 h-auto",
      lg: "text-base px-5 py-3 h-auto"
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={isLoading || disabled}
        {...rest}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">Cargando…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
