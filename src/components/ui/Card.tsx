import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[var(--radius-card)] bg-bg-elevated p-6 shadow-[var(--card-shadow)] md:p-8", className)} {...props}>
      {children}
    </div>
  );
}
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-fg md:text-xl", className)} {...props}>{children}</h3>;
}
export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-[15px] leading-relaxed text-fg-secondary", className)} {...props}>{children}</p>;
}
