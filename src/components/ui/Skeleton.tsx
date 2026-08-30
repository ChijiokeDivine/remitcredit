// src/components/ui/Skeleton.tsx
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Mirror-loading primitives: placeholders shaped like the content that will
 * replace them, rendered in place immediately instead of a spinner or a
 * page-level loading gate. Compose `Skeleton` freely, or use the presets
 * below to mirror the shapes that recur across the app (KPI cards, table
 * rows, list rows).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/** Mirrors a `Card className="!p-5"` stat tile (label + big figure). */
export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-24" />
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

/** Mirrors one row of the data-table pattern (amount / meta / status pill). */
export function SkeletonTableRow() {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

/** Mirrors an activity/transaction list row (icon + label + timestamp). */
export function SkeletonListRow() {
  return (
    <div className="flex items-start gap-4 py-4">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>
  );
}
