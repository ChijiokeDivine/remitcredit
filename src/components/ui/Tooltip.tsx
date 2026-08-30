// src/components/ui/Tooltip.tsx
"use client";
import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small info glyph with a hover/focus tooltip. Keeps labels short elsewhere. */
export function InfoTip({ label, className }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex h-3.5 w-3.5 items-center justify-center text-fg-muted transition-colors hover:text-fg", className)}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs leading-snug text-fg-secondary shadow-[var(--card-shadow)] transition-all duration-150",
          open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs leading-snug text-fg-secondary shadow-[var(--card-shadow)] transition-all duration-150",
          open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}
