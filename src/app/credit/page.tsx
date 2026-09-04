// src/app/credit/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { InfoTip } from "../../components/ui/Tooltip";
import { Skeleton, SkeletonStatRow } from "../../components/ui/Skeleton";
import { useWallet } from "../../lib/wallet";
import { getCredit, getCreditPreview, requestCreditReview, type CreditDecision, type CreditPreview, ApiError } from "../../lib/api";
import { formatAmount, formatRisk } from "../../lib/utils";
import { Gauge, RefreshCw, Info } from "lucide-react";

const THRESHOLDS = [
  { key: "transferCount", label: "Transfer count", description: "Verified remittances in the lookback window.", target: 3, unit: "" },
  { key: "totalAmount", label: "Total inflow", description: "Cumulative verified amount.", target: 300, unit: "$" },
  { key: "consistencyBps", label: "Interval consistency", description: "How regular transfers are. Higher is better.", target: 100, unit: "%" },
];

export default function CreditPage() {
  const { address } = useWallet();
  const [credit, setCredit] = useState<CreditDecision | null>(null);
  const [preview, setPreview] = useState<CreditPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([getCredit(address), getCreditPreview(address)]);
      setCredit(c);
      setPreview(p);
    } catch { /* offline */ } finally { setLoading(false); }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async () => {
    if (!address) return;
    setReviewing(true);
    setMsg(null);
    try {
      const res = await requestCreditReview(address);
      setCredit(res);
      setMsg("Credit review submitted on-chain.");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Review failed.");
    } finally { setReviewing(false); }
  };

  if (!address) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center">
          <Card><CardTitle>Connect your wallet</CardTitle><CardDescription>See how your limit is calculated.</CardDescription></Card>
        </div>
      </AppShell>
    );
  }

  const stats = preview?.stats;
  const decision = preview?.decision ?? credit;
  const progress = (current: number, target: number) => Math.min(100, Math.round((current / target) * 100));
  const initialLoading = loading && !decision;

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Credit decision</h1>
            <p className="mt-2 text-[15px] text-fg-secondary">Rules-based. Every input is on-chain.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReview} loading={reviewing}>
            <RefreshCw className="h-3.5 w-3.5" /> Recheck limit
          </Button>
        </div>

        {msg && <p className="mb-4 rounded-2xl border border-border bg-bg-muted px-4 py-3 text-sm text-fg">{msg}</p>}

        {initialLoading ? (
          <SkeletonStatRow count={3} />
        ) : (
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card className="!p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Limit</p>
              <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">${formatAmount(decision?.creditLimit ?? "0")}</p>
            </Card>
            <Card className="!p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Status</p>
              <div className="mt-3"><Badge tone={decision?.eligible ? "success" : "muted"}>{decision?.eligible ? "Eligible" : "Building history"}</Badge></div>
            </Card>
            <Card className="!p-5">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Risk</p>
                <InfoTip label="Lower is better. 0 is the strongest score." />
              </div>
              <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">{decision ? formatRisk(decision.riskScoreBps) : "—"}</p>
            </Card>
          </div>
        )}

        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted"><Info className="h-4 w-4 text-fg" /></div>
            <div className="min-w-0 flex-1">
              <CardTitle className="!text-base">Rationale</CardTitle>
              {initialLoading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">
                  {preview?.rationale || "No decision yet. Verified remittances unlock a limit."}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted"><Gauge className="h-4 w-4 text-fg" /></div>
            <div>
              <CardTitle className="!text-base">Toward next tier</CardTitle>
              <CardDescription>How your history compares to the thresholds.</CardDescription>
            </div>
          </div>
          {initialLoading ? (
            <div className="space-y-6">
              {THRESHOLDS.map((t) => (
                <div key={t.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {THRESHOLDS.map((t) => {
                let current = 0;
                if (stats) {
                  if (t.key === "transferCount") current = stats.transferCount;
                  if (t.key === "totalAmount") current = Number(stats.totalAmount) / 1e6;
                  if (t.key === "consistencyBps") current = stats.consistencyBps / 100;
                }
                const pct = progress(current, t.target);
                return (
                  <div key={t.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-fg">{t.label}</p>
                        <InfoTip label={t.description} />
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-fg-secondary">
                        {t.unit === "$" ? `$${current.toFixed(0)}` : current.toFixed(0)}
                        {t.unit === "%" ? "%" : ""}
                        <span className="text-fg-muted"> / {t.unit === "$" ? `$${t.target}` : t.target}{t.unit === "%" ? "%" : ""}</span>
                      </p>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
                      <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
