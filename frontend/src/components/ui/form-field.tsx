import * as React from "react";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
};

export function FormField({
  id,
  label,
  children,
  hint,
  error,
  className
}: FormFieldProps) {
  const describedById = error
    ? `${id}-error`
    : hint
    ? `${id}-hint`
    : undefined;

  // Si children es un elemento React válido, le inyectamos props de accesibilidad
  const enhancedChild = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        id,
        "aria-describedby": describedById
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--text-primary)]"
      >
        {label}
      </label>

      {enhancedChild}

      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="text-xs text-[var(--text-secondary)]"
        >
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
