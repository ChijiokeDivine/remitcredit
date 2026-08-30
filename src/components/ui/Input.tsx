// src/components/ui/Input.tsx
"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-bg-elevated px-3.5 text-[15px] text-fg",
            "placeholder:text-fg-muted transition-colors duration-150",
            "hover:border-border-strong focus:border-accent focus:outline-none",
            error && "border-danger-fg", className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-danger-fg">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-fg-muted">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
