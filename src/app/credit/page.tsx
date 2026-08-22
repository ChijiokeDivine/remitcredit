"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useWallet } from "../../lib/wallet";
import { getCredit, getCreditPreview, requestCreditReview, type CreditDecision, type CreditPreview, ApiError } from "../../lib/api";
import { formatAmount, formatRisk } from "../../lib/utils";
import { Gauge, RefreshCw, Info } from "lucide-react";

const THRESHOLDS = [
  { key: "transferCount", label: "Transfer count", description: "Minimum number of verified remittances in the lookback window", target: 3, unit: "" },
  { key: "totalAmount", label: "Total inflow", description: "Minimum cumulative verified amount (USDC units)", target: 300, unit: "$" },
  { key: "consistencyBps", label: "Interval consistency", description: "How regular the transfers are (higher = more consistent)", target: 50, unit: "%" },
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
          <Card><CardTitle>Connect your wallet</CardTitle><CardDescription>See how your credit limit is calculated.</CardDescription></Card>
        </div>
      </AppShell>
    );
  }

  const stats = preview?.stats;
  const decision = preview?.decision ?? credit;
  const progress = (current: number, target: number) => Math.min(100, Math.round((current / target) * 100));

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Credit decision</h1>
            <p className="mt-2 text-[15px] text-fg-secondary">Transparent, rules-based. Every input is on-chain.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReview} loading={reviewing}>
            <RefreshCw className="h-3.5 w-3.5" /> Recheck limit
          </Button>
        </div>
        {msg && <p className="mb-6 rounded-[16px] bg-bg-muted px-4 py-3 text-sm text-fg">{msg}</p>}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Limit</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-fg">${formatAmount(decision?.creditLimit ?? "0")}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Status</p>
            <div className="mt-3"><Badge tone={decision?.eligible ? "success" : "muted"}>{decision?.eligible ? "Eligible" : "Building history"}</Badge></div>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Risk</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-fg">{decision ? formatRisk(decision.riskScoreBps) : "—"}</p>
          </Card>
        </div>
        <Card className="mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted"><Info className="h-4 w-4 text-fg" /></div>
            <div>
              <CardTitle className="!text-base">Rationale</CardTitle>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">
                {preview?.rationale || (loading ? "Loading…" : "No decision yet. Accumulate verified remittances to unlock a limit.")}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted"><Gauge className="h-4 w-4 text-fg" /></div>
            <div>
              <CardTitle className="!text-base">Toward next tier</CardTitle>
              <CardDescription>How your verified history compares to the decision thresholds.</CardDescription>
            </div>
          </div>
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
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <p className="text-sm font-medium text-fg">{t.label}</p>
                    <p className="text-sm text-fg-secondary">
                      {t.unit === "$" ? `$${current.toFixed(0)}` : current.toFixed(0)}
                      {t.unit === "%" ? "%" : ""}
                      <span className="text-fg-muted"> / {t.unit === "$" ? `$${t.target}` : t.target}{t.unit === "%" ? "%" : ""}</span>
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
                    <div className="h-full rounded-full bg-fg transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-fg-muted">{t.description}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
