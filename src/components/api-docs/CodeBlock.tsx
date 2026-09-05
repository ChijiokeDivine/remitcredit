"use client";

import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language = "json",
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  return (
    <div className={cn("group relative overflow-hidden rounded-xl border border-border bg-bg-muted/40", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[12.5px] leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}
