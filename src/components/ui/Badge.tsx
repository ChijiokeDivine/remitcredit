// src/components/ui/Badge.tsx
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "default" | "success" | "muted" | "outline" | "warning" | "danger";

// Status values stay short nouns (Paid / Pending / Failed / Active). Colour
// is functional, not decorative — kept low-saturation so a row of pills
// never turns the page into a rainbow.
const tones: Record<Tone, string> = {
  default: "bg-fg text-bg",
  success: "bg-accent text-accent-fg",
  muted: "bg-bg-muted text-fg-secondary",
  outline: "border border-border-strong text-fg-secondary",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
};

export function Badge({ className, tone = "default", children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...props}>
      {children}
    </span>
  );
}
