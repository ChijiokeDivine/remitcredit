"use client";

import { useMemo, useState } from "react";
import type { EndpointDoc } from "@/lib/api-docs/registry";
import { API_BASE } from "@/lib/api-docs/registry";
import { MethodBadge } from "./MethodBadge";
import { CopyButton } from "./CopyButton";
import { CodeBlock } from "./CodeBlock";
import { ApiPlayground } from "./ApiPlayground";
import Link from "next/link";
import { cn } from "@/lib/utils";

function buildCurl(ep: EndpointDoc): string {
  const lines = [`curl -X ${ep.method} "${API_BASE}${ep.path.replace(/\{[^}]+\}/g, "VALUE")}"`];
  if (ep.auth) lines.push(`  -H "Authorization: Bearer $TOKEN"`);
  if (ep.method !== "GET" && ep.exampleRequest) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${JSON.stringify(ep.exampleRequest)}'`);
  }
  return lines.join(" \\\n");
}

function buildTs(ep: EndpointDoc): string {
  const hasBody = ep.method !== "GET" && ep.method !== "DELETE" && ep.exampleRequest;
  return `const res = await fetch("${API_BASE}${ep.path.replace(/\{[^}]+\}/g, "${id}")}", {
  method: "${ep.method}",
  headers: {
    ${ep.auth ? `"Authorization": \`Bearer \${token}\`,` : ""}
    ${hasBody ? `"Content-Type": "application/json",` : ""}
  },
  ${hasBody ? `body: JSON.stringify(${JSON.stringify(ep.exampleRequest, null, 2)}),` : ""}
});
const data = await res.json();
console.log(res.status, data);`;
}

function buildPython(ep: EndpointDoc): string {
  const hasBody = ep.method !== "GET" && ep.method !== "DELETE" && ep.exampleRequest;
  return `import requests

headers = {}
${ep.auth ? `headers["Authorization"] = f"Bearer {token}"` : ""}
${hasBody ? `headers["Content-Type"] = "application/json"` : ""}

res = requests.request(
    "${ep.method}",
    "https://your-host${API_BASE}${ep.path}",
    headers=headers,
    ${hasBody ? `json=${JSON.stringify(ep.exampleRequest, null, 4)},` : ""}
)
print(res.status_code, res.json())`;
}

export function EndpointView({ endpoint }: { endpoint: EndpointDoc }) {
  const [lang, setLang] = useState<"curl" | "ts" | "python">("curl");
  const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${API_BASE}${endpoint.path}`;

  const code = useMemo(() => {
    if (lang === "curl") return buildCurl(endpoint);
    if (lang === "ts") return buildTs(endpoint);
    return buildPython(endpoint);
  }, [lang, endpoint]);

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
      <article className="min-w-0 space-y-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <code className="rounded-md bg-bg-muted px-2 py-1 font-mono text-sm text-fg">
              {API_BASE}
              {endpoint.path}
            </code>
            <CopyButton text={`${API_BASE}${endpoint.path}`} label="Copy path" />
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg">
            {endpoint.title}
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-fg-secondary">{endpoint.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <MetaChip label="Auth" value={endpoint.auth ? "Bearer session" : "None"} />
            <MetaChip label="On-chain" value={endpoint.onChain ? "Yes (relayer)" : "No"} />
            {endpoint.needsSignature && <MetaChip label="Wallet sign" value="SIWE required" />}
          </div>
        </header>

        <Section title="When to use">
          <p className="text-sm leading-relaxed text-fg-secondary">{endpoint.whenToUse}</p>
        </Section>

        <Section title="What happens">
          <p className="text-sm leading-relaxed text-fg-secondary">{endpoint.whatHappens}</p>
        </Section>

        <Section title="HTTP">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-muted/40 px-3 py-2.5 font-mono text-sm">
            <MethodBadge method={endpoint.method} />
            <span className="text-fg break-all">
              {API_BASE}
              {endpoint.path}
            </span>
            <CopyButton text={fullUrl || `${API_BASE}${endpoint.path}`} />
          </div>
        </Section>

        {endpoint.headers.length > 0 && (
          <Section title="Headers">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-fg-muted">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Required</th>
                  <th className="py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.headers.map((h) => (
                  <tr key={h.name} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs text-fg">{h.name}</td>
                    <td className="py-2 pr-3 text-fg-secondary">{h.required ? "Yes" : "No"}</td>
                    <td className="py-2 text-fg-secondary">{h.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {endpoint.fields.length > 0 && (
          <Section title="Parameters">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-fg-muted">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">In</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Required</th>
                  <th className="py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.fields.map((f) => (
                  <tr key={`${f.in}-${f.name}`} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-fg">{f.name}</td>
                    <td className="py-2 pr-3 text-fg-secondary">{f.in}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-fg-secondary">{f.type}</td>
                    <td className="py-2 pr-3 text-fg-secondary">{f.required ? "Yes" : "No"}</td>
                    <td className="py-2 text-fg-secondary">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {endpoint.exampleRequest && (
          <Section title="Example request body">
            <CodeBlock code={JSON.stringify(endpoint.exampleRequest, null, 2)} language="json" />
          </Section>
        )}

        <Section title="Example response">
          <CodeBlock code={JSON.stringify(endpoint.exampleResponse, null, 2)} language="json" />
        </Section>

        <Section title="Status codes">
          <ul className="space-y-2">
            {endpoint.statusCodes.map((s) => (
              <li key={s.code} className="flex gap-3 text-sm">
                <span className="font-mono font-medium text-fg w-10 shrink-0">{s.code}</span>
                <span>
                  <span className="font-medium text-fg">{s.label}</span>
                  <span className="text-fg-secondary"> — {s.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Code examples">
          <div className="mb-2 flex gap-1">
            {(["curl", "ts", "python"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                  lang === l ? "bg-fg text-bg" : "text-fg-secondary hover:bg-bg-muted"
                )}
              >
                {l === "ts" ? "TypeScript" : l === "curl" ? "cURL" : "Python"}
              </button>
            ))}
          </div>
          <CodeBlock code={code} language={lang === "ts" ? "typescript" : lang} />
        </Section>

        {endpoint.notes && endpoint.notes.length > 0 && (
          <Section title="Notes">
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-secondary">
              {endpoint.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Section>
        )}

        {endpoint.related.length > 0 && (
          <Section title="Related">
            <div className="flex flex-wrap gap-2">
              {endpoint.related.map((slug) => (
                <Link
                  key={slug}
                  href={`/docs/api/${slug}`}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-secondary hover:bg-bg-muted hover:text-fg"
                >
                  {slug}
                </Link>
              ))}
            </div>
          </Section>
        )}
      </article>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">Try it</p>
        <ApiPlayground endpoint={endpoint} />
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border bg-bg-muted/60 px-2.5 py-1 text-fg-secondary">
      <span className="text-fg-muted">{label}:</span> {value}
    </span>
  );
}
