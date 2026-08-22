"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <button type="button" className={cn("flex h-9 w-9 items-center justify-center rounded-md", className)} aria-label="Toggle theme" />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 hover:bg-bg-muted active:scale-95", className)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4 text-fg" strokeWidth={1.75} /> : <Moon className="h-4 w-4 text-fg" strokeWidth={1.75} />}
    </button>
  );
}
