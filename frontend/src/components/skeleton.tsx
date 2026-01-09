export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.08)] rounded-md ${className}`}
    />
  );
}
