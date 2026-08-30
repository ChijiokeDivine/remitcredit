// src/components/ui/Card.tsx
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

// Self-contained "window": soft low elevation, generous padding, a hairline
// border doing as much work as the shadow. Every distinct concern gets its
// own card rather than one dense monolithic panel.
export function Card({ className, children, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-elevated p-6 shadow-[var(--card-shadow)] transition-colors duration-150 md:p-7",
        interactive && "cursor-pointer hover:border-border-strong",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-fg md:text-xl", className)} {...props}>{children}</h3>;
}
export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm leading-relaxed text-fg-secondary", className)} {...props}>{children}</p>;
}
