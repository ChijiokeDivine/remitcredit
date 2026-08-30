// src/components/ui/Button.tsx
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

// Named after the action it performs, never "success"/generic states — the
// button label and any resulting toast should share the same vocabulary.
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90 active:opacity-80 disabled:opacity-40",
  secondary: "bg-bg-muted text-fg hover:bg-bg-muted/80 active:opacity-90 disabled:opacity-40",
  ghost: "bg-transparent text-fg hover:bg-bg-muted active:opacity-90 disabled:opacity-40",
  outline: "bg-transparent text-fg border border-border-strong hover:bg-bg-muted active:opacity-90 disabled:opacity-40",
  danger: "bg-fg text-bg hover:opacity-90 active:opacity-80 disabled:opacity-40",
};
// Slightly rounder than before (8–10px) to match the card/pill radius scale
// used across the product register.
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-[15px] rounded-lg",
  lg: "h-12 px-6 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, onClick, ...props }, ref) => {
    // Tactile press: a quick scale-down-and-back on every click, plus a
    // baseline active:scale so the button also feels pressed on touch
    // devices/keyboards before the animation class even applies.
    const [pressed, setPressed] = useState(false);
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:active:scale-100",
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
