import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-line/60 motion-safe:animate-pulse ${className}`}
    />
  );
}

export function LoadingRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function LoadingStatus({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 text-xs text-ink-muted ${className}`}
    >
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
      />
      {label}
    </span>
  );
}
