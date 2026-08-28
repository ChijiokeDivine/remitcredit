"use client";
import type { ReactNode } from "react";
import { useWallet } from "@/lib/wallet";
import { Sidebar, MobileBar, GuestBar } from "./AppNav";

export function AppShell({ children }: { children: ReactNode }) {
  const { address } = useWallet();

  if (!address) {
    return (
      <div className="min-h-dvh bg-bg">
        <GuestBar />
        <main className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1400px] items-center justify-center px-4 py-10 md:px-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
