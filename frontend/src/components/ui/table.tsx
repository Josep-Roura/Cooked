import { cn } from "@/lib/utils";
import * as React from "react";

export function TableWrapper({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm overflow-x-auto",
        className
      )}
    >
      <table className="min-w-full text-sm text-left text-[var(--text-primary)]">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-[rgba(0,0,0,0.03)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

// ⬇️ Aquí está la clave: ahora TR acepta props nativas de <tr>
export function TR({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & {
  className?: string;
}) {
  return (
    <tr
      className={cn("hover:bg-black/5", className)}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium whitespace-nowrap",
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-[var(--text-primary)]",
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
