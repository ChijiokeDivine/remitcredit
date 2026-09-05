
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { searchEndpoints } from "@/lib/api-docs/registry";
import { MethodBadge } from "./MethodBadge";
import { Search } from "lucide-react";

export function DocsSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(
    () => (q.trim() ? searchEndpoints(q).slice(0, 8) : []),
    [q]
  );

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <Search className="h-4 w-4 text-fg-muted" />

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search endpoints…"
          className="w-[calc(100%-40px)] bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-bg-elevated py-1 shadow-[var(--card-shadow)]">
          {results.map((ep) => (
            <li key={ep.slug}>
              <Link
                href={`/docs/api/${ep.slug}`}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-muted"
                onClick={() => {
                  setQ("");
                  setOpen(false);
                }}
              >
                <MethodBadge method={ep.method} />
                <span className="truncate text-fg">{ep.title}</span>
                <span className="ml-auto font-mono text-[11px] text-fg-muted">
                  {ep.path}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
