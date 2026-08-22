import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "default" | "success" | "muted" | "outline";
const tones: Record<Tone, string> = {
  default: "bg-fg text-bg",
  success: "bg-accent text-accent-fg",
  muted: "bg-bg-muted text-fg-secondary",
  outline: "border border-border-strong text-fg-secondary",
};

export function Badge({ className, tone = "default", children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...props}>
      {children}
    </span>
  );
}
