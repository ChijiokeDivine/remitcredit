"use client";

import { useState } from "react";
import Link from "next/link";
import { DocsAuthProvider, useDocsAuth } from "@/components/api-docs/DocsAuthContext";
import { DocsSidebar } from "@/components/api-docs/DocsSidebar";
import { DocsSearch } from "@/components/api-docs/DocsSearch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Menu, X } from "lucide-react";
import { shortAddress } from "@/lib/utils";

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const auth = useDocsAuth();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg-secondary hover:bg-bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/docs/api" className="shrink-0 font-[family-name:var(--font-serif)] text-lg italic">
            RemitCredit
          </Link>
          <span className="hidden text-sm text-fg-muted sm:inline">API Docs</span>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:ml-6 sm:flex-none sm:justify-start md:flex-1">
            <DocsSearch />
          </div>
          <div className="flex items-center gap-2">
            {auth.sessionToken ? (
              <span className="hidden font-mono text-xs text-fg-secondary md:inline">
                {shortAddress(auth.sessionAddress ?? "")}
              </span>
            ) : auth.isConnected ? (
              <Button size="sm" variant="outline" loading={auth.isAuthenticating} onClick={() => auth.signInWithSiwe()}>
                SIWE sign-in
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={auth.connectWallet}>
                Connect
              </Button>
            )}
            <ThemeToggle />
            <Link href="/" className="hidden text-sm text-fg-secondary hover:text-fg md:inline">
              App
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border lg:block">
          <DocsSidebar />
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-bg-elevated">
              <div className="flex h-14 items-center justify-between px-3">
                <span className="font-[family-name:var(--font-serif)] italic">API</span>
                <button type="button" className="rounded-md p-2 hover:bg-bg-muted" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <DocsSidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsAuthProvider>
      <Shell>{children}</Shell>
    </DocsAuthProvider>
  );
}
