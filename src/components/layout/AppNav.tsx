"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { shortAddress, cn } from "@/lib/utils";
import { LayoutDashboard, History, Gauge, Banknote, Activity, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/remittances", label: "Remittances", icon: History },
  { href: "/credit", label: "Credit", icon: Gauge },
  { href: "/loans", label: "Loans", icon: Banknote },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function AppNav() {
  const pathname = usePathname();
  const { address, connect, disconnect, isConnecting } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-[family-name:var(--font-serif)] text-lg italic tracking-tight text-fg transition-opacity hover:opacity-70">
            RemitCredit
          </Link>
          {address && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href} className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                    active ? "bg-bg-muted text-fg" : "text-fg-secondary hover:bg-bg-muted hover:text-fg"
                  )}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {address ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-md bg-bg-muted px-2.5 py-1.5 font-mono text-xs text-fg-secondary sm:inline">
                {shortAddress(address)}
              </span>
              <button type="button" onClick={disconnect} className="flex h-9 w-9 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-bg-muted hover:text-fg active:scale-95" aria-label="Disconnect">
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={connect} loading={isConnecting} className="animate-pulse-ring">Connect</Button>
          )}
        </div>
      </div>
      {address && (
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1.5 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-bg-muted text-fg" : "text-fg-secondary hover:bg-bg-muted"
              )}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
