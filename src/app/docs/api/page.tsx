"use client";

import Link from "next/link";
import { endpointsByCategory, ENDPOINTS } from "@/lib/api-docs/registry";
import { MethodBadge } from "@/components/api-docs/MethodBadge";

export default function ApiDocsOverviewPage() {
  const groups = endpointsByCategory();

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Developer platform</p>
        <h1 className="font-[family-name:var(--font-serif)] text-4xl font-normal tracking-tight text-fg">
          RemitCredit API
        </h1>
        <p className="text-[16px] leading-relaxed text-fg-secondary">
          Programmatic access to declared senders, Attestcoin-proven remittances, credit decisions,
          and revolving loans on Creditcoin. Authenticate with SIWE — no API keys, no private keys
          on the server.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/docs/api/authentication"
            className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg"
          >
            Authentication guide
          </Link>
          <Link
            href="/docs/api/auth/challenge"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-bg-muted"
          >
            Start with challenge
          </Link>
          <a
            href="/api/v1/openapi"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-bg-muted"
          >
            OpenAPI JSON
          </a>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-bg-elevated p-5">
        <h2 className="text-sm font-semibold text-fg">Base URL</h2>
        <code className="mt-2 block font-mono text-sm text-fg">/api/v1</code>
        <p className="mt-3 text-sm text-fg-secondary">
          {ENDPOINTS.length} documented endpoints. Authoritative balances live on-chain; sessions,
          nonces, and idempotency keys live in Redis.
        </p>
      </section>

      <section className="space-y-8">
        {groups.map(({ category, items }) => (
          <div key={category.id}>
            <h2 className="mb-3 font-[family-name:var(--font-serif)] text-xl text-fg">
              {category.label}
            </h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-bg-elevated">
              {items.map((ep) => (
                <li key={ep.slug}>
                  <Link
                    href={`/docs/api/${ep.slug}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-bg-muted/50"
                  >
                    <MethodBadge method={ep.method} />
                    <span className="font-mono text-xs text-fg-muted">
                      /api/v1{ep.path}
                    </span>
                    <span className="w-full text-sm text-fg sm:w-auto sm:flex-1">{ep.title}</span>
                    <span className="hidden text-xs text-fg-secondary md:inline">{ep.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
