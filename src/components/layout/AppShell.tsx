"use client";
import { AppNav } from "./AppNav";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <AppNav />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-10">{children}</main>
    </div>
  );
}
