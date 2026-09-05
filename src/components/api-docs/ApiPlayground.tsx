"use client";

import { useMemo, useState } from "react";
import type { EndpointDoc } from "@/lib/api-docs/registry";
import { API_BASE } from "@/lib/api-docs/registry";
import { useDocsAuth } from "./DocsAuthContext";
import { Button } from "@/components/ui/Button";
import { MethodBadge } from "./MethodBadge";
import { CodeBlock } from "./CodeBlock";
import { AlertTriangle, Loader2, Send, Wallet } from "lucide-react";
import { shortAddress, cn } from "@/lib/utils";

function buildUrl(ep: EndpointDoc, pathValues: Record<string, string>, queryValues: Record<string, string>) {
  let path = ep.path;
  for (const [k, v] of Object.entries(pathValues)) {
    path = path.replace(`{${k}}`, encodeURIComponent(v));
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(queryValues)) {
    if (v !== "") qs.set(k, v);
  }
  const q = qs.toString();
  return `${API_BASE}${path}${q ? `?${q}` : ""}`;
}

export function ApiPlayground({ endpoint }: { endpoint: EndpointDoc }) {
  const auth = useDocsAuth();
  const pathFields = endpoint.fields.filter((f) => f.in === "path");
  const queryFields = endpoint.fields.filter((f) => f.in === "query");
  const bodyFields = endpoint.fields.filter((f) => f.in === "body");

  const [pathValues, setPathValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(pathFields.map((f) => [f.name, f.example ?? ""]))
  );
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(queryFields.map((f) => [f.name, f.example ?? ""]))
  );
  const [bodyValues, setBodyValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(bodyFields.map((f) => [f.name, f.example ?? ""]))
  );
  const [rawJson, setRawJson] = useState(() =>
    endpoint.exampleRequest ? JSON.stringify(endpoint.exampleRequest, null, 2) : "{}"
  );
  const [useRaw, setUseRaw] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [confirmOnChain, setConfirmOnChain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [requestPreview, setRequestPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(
    () => buildUrl(endpoint, pathValues, queryValues),
    [endpoint, pathValues, queryValues]
  );

  async function send() {
    setError(null);
    setResponseText(null);
    setStatus(null);
    setDurationMs(null);

    if (endpoint.auth && !auth.sessionToken) {
      setError("This endpoint requires a session token. Use “Sign in with wallet” first.");
      return;
    }
    if (endpoint.onChain && endpoint.destructive && !confirmOnChain) {
      setError("Confirm that you understand this may submit an on-chain transaction.");
      return;
    }

    let body: string | undefined;
    if (endpoint.method !== "GET" && endpoint.method !== "DELETE") {
      if (useRaw || bodyFields.some((f) => f.type === "json" || f.type === "string[]")) {
        try {
          JSON.parse(rawJson);
          body = rawJson;
        } catch {
          setError("Request body is not valid JSON.");
          return;
        }
      } else if (bodyFields.length > 0) {
        const obj: Record<string, unknown> = {};
        for (const f of bodyFields) {
          const v = bodyValues[f.name];
          if (v === "" || v === undefined) {
            if (f.required) {
              setError(`Missing required field: ${f.name}`);
              return;
            }
            continue;
          }
          if (f.type === "number") obj[f.name] = Number(v);
          else if (f.type === "boolean") obj[f.name] = v === "true";
          else if (f.type === "string[]") {
            try {
              obj[f.name] = JSON.parse(v);
            } catch {
              obj[f.name] = v.split(",").map((s) => s.trim()).filter(Boolean);
            }
          } else obj[f.name] = v;
        }
        body = JSON.stringify(obj);
      }
    }

    // DELETE may have no body
    if (endpoint.method === "DELETE" && bodyFields.length === 0) body = undefined;

    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (endpoint.auth && auth.sessionToken) headers.Authorization = `Bearer ${auth.sessionToken}`;
    if (idempotencyKey.trim()) headers["Idempotency-Key"] = idempotencyKey.trim();

    const preview = [
      `${endpoint.method} ${url}`,
      ...Object.entries(headers).map(([k, v]) =>
        k === "Authorization" ? `${k}: Bearer ${v.slice(7, 15)}…` : `${k}: ${v}`
      ),
      body ? `\n${body}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    setRequestPreview(preview);

    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: endpoint.method, headers, body });
      const text = await res.text();
      setDurationMs(Math.round(performance.now() - t0));
      setStatus(res.status);
      try {
        setResponseText(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseText(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-elevated p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <span className="font-mono text-sm text-fg">{endpoint.path}</span>
        </div>
        <span className="text-xs text-fg-muted">Live request to this deployment</span>
      </div>

      {/* Auth strip */}
      <div className="rounded-xl border border-border bg-bg-muted/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {!auth.isConnected ? (
            <Button size="sm" type="button" onClick={auth.connectWallet}>
              <Wallet className="h-3.5 w-3.5" /> Connect wallet
            </Button>
          ) : (
            <span className="rounded-md bg-bg-elevated px-2 py-1 font-mono text-xs text-fg">
              {shortAddress(auth.address ?? "")}
            </span>
          )}
          {endpoint.auth && (
            <>
              {auth.sessionToken ? (
                <span className="text-xs text-fg-secondary">
                  Session: {shortAddress(auth.sessionAddress ?? "", 3)} ·{" "}
                  <button type="button" className="text-accent underline" onClick={auth.clearSession}>
                    Clear
                  </button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  loading={auth.isAuthenticating}
                  onClick={() => auth.signInWithSiwe()}
                >
                  Sign in with wallet (SIWE)
                </Button>
              )}
            </>
          )}
        </div>
        {auth.authError && <p className="mt-2 text-xs text-danger-fg">{auth.authError}</p>}
      </div>

      {endpoint.onChain && (
        <div className="flex gap-2 rounded-xl border border-warning-fg/20 bg-warning-bg/40 p-3 text-xs text-warning-fg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">On-chain operation</p>
            <p className="mt-0.5 opacity-90">
              The backend relayer may submit a Creditcoin transaction. This is not a simulated response.
            </p>
            {endpoint.destructive && (
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={confirmOnChain}
                  onChange={(e) => setConfirmOnChain(e.target.checked)}
                />
                I understand this may move funds or change on-chain state
              </label>
            )}
          </div>
        </div>
      )}

      {/* Path / query */}
      {pathFields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="text-xs font-medium text-fg-muted">
            Path · {f.name} {f.required && <span className="text-danger-fg">*</span>}
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-fg"
            value={pathValues[f.name] ?? ""}
            onChange={(e) => setPathValues((p) => ({ ...p, [f.name]: e.target.value }))}
            placeholder={f.example}
          />
        </label>
      ))}
      {queryFields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="text-xs font-medium text-fg-muted">Query · {f.name}</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-fg"
            value={queryValues[f.name] ?? ""}
            onChange={(e) => setQueryValues((p) => ({ ...p, [f.name]: e.target.value }))}
            placeholder={f.example}
          />
        </label>
      ))}

      {/* Body */}
      {bodyFields.length > 0 && endpoint.method !== "GET" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-muted">Body</span>
            <button
              type="button"
              className="text-xs text-accent underline"
              onClick={() => setUseRaw((v) => !v)}
            >
              {useRaw ? "Structured fields" : "Raw JSON"}
            </button>
          </div>
          {useRaw || bodyFields.some((f) => f.type === "string[]") ? (
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-fg"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
            />
          ) : (
            bodyFields.map((f) => (
              <label key={f.name} className="block text-sm">
                <span className="text-xs font-medium text-fg-muted">
                  {f.name} {f.required && <span className="text-danger-fg">*</span>}
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-fg"
                  value={bodyValues[f.name] ?? ""}
                  onChange={(e) => setBodyValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  placeholder={f.example}
                />
              </label>
            ))
          )}
        </div>
      )}

      {endpoint.headers.some((h) => h.name === "Idempotency-Key") && (
        <label className="block text-sm">
          <span className="text-xs font-medium text-fg-muted">Idempotency-Key (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-fg"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            placeholder="unique-client-key"
          />
        </label>
      )}

      <Button type="button" onClick={send} loading={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 hidden" /> : <Send className="h-4 w-4" />}
        Send request
      </Button>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      {requestPreview && (
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">Request</p>
          <CodeBlock code={requestPreview} language="http" />
        </div>
      )}

      {(status !== null || responseText) && (
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-medium text-fg-muted">
            Response
            {status !== null && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono",
                  status < 300 ? "bg-accent/15 text-accent" : "bg-danger-bg text-danger-fg"
                )}
              >
                {status}
                {durationMs != null ? ` · ${durationMs}ms` : ""}
              </span>
            )}
          </p>
          <CodeBlock code={responseText ?? ""} language="json" />
        </div>
      )}
    </div>
  );
}
