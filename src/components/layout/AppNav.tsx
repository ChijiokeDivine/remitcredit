// src/components/layout/AppNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useWallet } from "@/lib/wallet";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { shortAddress, cn } from "@/lib/utils";
import { LayoutDashboard, History, Gauge, Banknote, Activity, Users, LogOut, Menu, X } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/remittances", label: "Remittances", icon: History },
  { href: "/credit", label: "Credit", icon: Gauge },
  { href: "/loans", label: "Loans", icon: Banknote },
  { href: "/activity", label: "Activity", icon: Activity },
];

const NAV_SECONDARY = [{ href: "/onboarding", label: "Senders", icon: Users }];

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-serif)] text-lg italic tracking-tight text-fg", className)}>
      RemitCredit
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const renderLink = ({ href, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
          // Active item: a subtle accent tint, not a heavy filled pill.
          active ? "bg-accent/10 text-accent" : "text-fg-secondary hover:bg-bg-muted hover:text-fg"
        )}
      >
        
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map(renderLink)}
      <p className="mb-1 mt-5 px-3 text-[11px] font-medium uppercase tracking-wider text-fg-muted">Account</p>
      {NAV_SECONDARY.map(renderLink)}
    </nav>
  );
}

function WalletChip({ address, disconnect }: { address: string; disconnect: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-bg-muted px-2.5 py-2">
      <span className="font-mono text-xs text-fg-secondary">{shortAddress(address)}</span>
      <button
        type="button"
        onClick={disconnect}
        aria-label="Disconnect"
        className="flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg active:scale-95"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Left sidebar shown on desktop once a wallet is connected. */
export function Sidebar() {
  const { address, disconnect } = useWallet();
  if (!address) return null;
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border md:flex">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" className="transition-opacity hover:opacity-70">
          <Wordmark />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavList />
      </div>
      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <WalletChip address={address} disconnect={disconnect} />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-fg-muted">Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!open) { setShow(false); return; }
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200", show ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-bg-elevated transition-transform duration-200 ease-out",
          show ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Compact top bar + slide-in drawer shown on mobile once connected. */
export function MobileBar() {
  const { address, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  if (!address) return null;
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-bg-muted"
        >
          <Menu className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>
        <Wordmark />
        <ThemeToggle />
      </div>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-bg-muted"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
        <div className="shrink-0 border-t border-border p-3">
          <WalletChip address={address} disconnect={disconnect} />
        </div>
      </Drawer>
    </>
  );
}

/** Simple top bar shown before a wallet is connected — no sidebar yet. */
export function GuestBar() {
  const { connect, isConnecting } = useWallet();
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-md md:px-6">
      <Link href="/" className="transition-opacity hover:opacity-70">
        <Wordmark />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button size="sm" onClick={connect} loading={isConnecting} className="animate-pulse-ring">Connect</Button>
      </div>
    </header>
  );
}
