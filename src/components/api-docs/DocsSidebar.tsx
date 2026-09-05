"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { endpointsByCategory } from "@/lib/api-docs/registry";
import { MethodBadge } from "./MethodBadge";
import { cn } from "@/lib/utils";

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = endpointsByCategory();

  return (
    <nav className="space-y-5 px-3 py-4">
      <div>
        <Link
          href="/docs/api"
          onClick={onNavigate}
          className={cn(
            "block rounded-lg px-2.5 py-2 text-sm font-medium transition",
            pathname === "/docs/api" ? "bg-accent/10 text-accent" : "text-fg-secondary hover:bg-bg-muted hover:text-fg"
          )}
        >
          Overview
        </Link>
        <Link
          href="/docs/api/authentication"
          onClick={onNavigate}
          className={cn(
            "mt-0.5 block rounded-lg px-2.5 py-2 text-sm font-medium transition",
            pathname === "/docs/api/authentication"
              ? "bg-accent/10 text-accent"
              : "text-fg-secondary hover:bg-bg-muted hover:text-fg"
          )}
        >
          Authentication guide
        </Link>
      </div>

      {groups.map(({ category, items }) => (
        <div key={category.id}>
          <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
            {category.label}
          </p>
          <ul className="space-y-0.5">
            {items.map((ep) => {
              const href = `/docs/api/${ep.slug}`;
              const active = pathname === href;
              return (
                <li key={ep.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                      active ? "bg-accent/10 text-accent" : "text-fg-secondary hover:bg-bg-muted hover:text-fg"
                    )}
                  >
                    <MethodBadge method={ep.method} className="!px-1.5 !text-[10px]" />
                    <span className="truncate">{ep.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
