"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  className,
  label = "Copy",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-fg-secondary transition hover:bg-bg-muted hover:text-fg",
        className
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copied" : label}
    </button>
  );
}
