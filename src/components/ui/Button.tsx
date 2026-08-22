"use client";
import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90 active:opacity-80 disabled:opacity-40",
  secondary: "bg-bg-muted text-fg hover:bg-bg-muted/80 active:opacity-90 disabled:opacity-40",
  ghost: "bg-transparent text-fg hover:bg-bg-muted active:opacity-90 disabled:opacity-40",
  outline: "bg-transparent text-fg border border-border-strong hover:bg-bg-muted active:opacity-90 disabled:opacity-40",
  danger: "bg-fg text-bg hover:opacity-90 active:opacity-80 disabled:opacity-40",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-md",
  md: "h-11 px-5 text-[15px] rounded-md",
  lg: "h-12 px-6 text-base rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, onClick, ...props }, ref) => {
    const [pressed, setPressed] = useState(false);
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none disabled:pointer-events-none",
          variants[variant], sizes[size], pressed && "animate-press", className
        )}
        disabled={disabled || loading}
        onClick={(e) => { setPressed(true); setTimeout(() => setPressed(false), 200); onClick?.(e); }}
        {...props}
      >
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
