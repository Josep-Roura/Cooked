import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

type Variant = "success" | "warning" | "error" | "info";

const VARIANT_STYLES: Record<
  Variant,
  { icon: React.ElementType; bg: string; border: string; text: string }
> = {
  success: {
    icon: CheckCircle,
    bg: "bg-[hsl(142,70%,40%,0.08)]",
    border: "border-success",
    text: "text-success"
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-[hsl(38,92%,50%,0.08)]",
    border: "border-warning",
    text: "text-warning"
  },
  error: {
    icon: XCircle,
    bg: "bg-[hsl(0,84%,60%,0.08)]",
    border: "border-error",
    text: "text-error"
  },
  info: {
    icon: Info,
    bg: "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)]",
    border: "border-border",
    text: "text-[var(--text-primary)]"
  }
};

export function Alert({
  variant = "info",
  title,
  description,
  className
}: {
  variant?: Variant;
  title: string;
  description?: string;
  className?: string;
}) {
  const { icon: Icon, bg, border, text } = VARIANT_STYLES[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm flex items-start gap-3",
        bg,
        border,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", text)} />
      <div className="space-y-1">
        <div className={cn("font-medium leading-none", text)}>{title}</div>
        {description && (
          <p className="text-[var(--text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
