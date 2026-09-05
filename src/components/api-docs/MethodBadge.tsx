import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/lib/api-docs/registry";

const styles: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-300",
  PUT: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  PATCH: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        styles[method],
        className
      )}
    >
      {method}
    </span>
  );
}
