import { cn } from "@/lib/utils";

export function Loader({
  size = "md",
  className
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]"
  };

  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-transparent border-t-primary",
        sizeMap[size],
        className
      )}
      aria-label="Cargando"
      role="status"
    />
  );
}
