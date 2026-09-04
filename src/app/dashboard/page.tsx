// src/app/dashboard/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { InfoTip } from "../../components/ui/Tooltip";
import { Skeleton, SkeletonStatRow, SkeletonList } from "../../components/ui/Skeleton";
import { useWallet } from "../../lib/wallet";
import { getCredit, getLoan, getCreditPreview, getRemittances, getBorrower, type CreditDecision, type LoanStatus, type CreditPreview, type VerifiedTransfer } from "../../lib/api";
import { formatAmount, formatRisk, shortAddress, relativeTime } from "../../lib/utils";
import { ArrowRight, RefreshCw, Wallet, TrendingUp, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { address, connect, isConnecting } = useWallet();
  const [credit, setCredit] = useState<CreditDecision | null>(null);
  const [loan, setLoan] = useState<LoanStatus | null>(null);
  const [preview, setPreview] = useState<CreditPreview | null>(null);
  const [transfers, setTransfers] = useState<VerifiedTransfer[]>([]);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        getBorrower(address), getCredit(address), getLoan(address), getCreditPreview(address), getRemittances(address),
      ]);
      if (results[0].status === "fulfilled") {
        setRegistered(Boolean(results[0].value.registered));
      } else {
        setRegistered(null);
      }
      if (results[1].status === "fulfilled") setCredit(results[1].value);
      if (results[2].status === "fulfilled") setLoan(results[2].value);
      if (results[3].status === "fulfilled") setPreview(results[3].value);
      if (results[4].status === "fulfilled") setTransfers(results[4].value.transfers ?? []);
    } catch {
      setError("Couldn't load data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  if (!address) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center animate-fade-up">
          <Card>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-muted"><Wallet className="h-5 w-5 text-fg" /></div>
            <CardTitle>Connect to continue</CardTitle>
            <CardDescription>See your credit line and activity.</CardDescription>
            <Button className="mt-6 w-full" onClick={connect} loading={isConnecting}>Connect wallet</Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (registered === false) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center animate-fade-up">
          <Card>
            <CardTitle>Complete onboarding</CardTitle>
            <CardDescription>Declare a sender to start building credit.</CardDescription>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/onboarding"><Button className="w-full">Set up now <ArrowRight className="h-4 w-4" /></Button></Link>
              <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh status</Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (registered === null) {
    // Mirror loading: shape the placeholder like the dashboard it's about to
    // become, instead of a spinner or a generic "checking status" card.
    return (
      <AppShell>
        <div className="animate-fade-up">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <SkeletonStatRow />
          <Card className="mt-4 !p-5">
            <SkeletonList rows={3} />
          </Card>
        </div>
      </AppShell>
    );
  }

  // Prefer the live-computed preview decision over the persisted `credit`
  // record, same as the /credit page does — `credit` only reflects the last
  // on-chain review, so it can read stale/zeroed until a review is run.
  const decision = preview?.decision ?? credit;
  const limit = decision?.creditLimit ?? loan?.creditLimit ?? "0";
  const outstanding = loan?.outstandingPrincipal ?? "0";
  const available = loan?.availableCredit ?? "0";
  const eligible = decision?.eligible ?? false;
  const utilizationPct = Number(limit) > 0 ? Math.min(100, Math.round((Number(outstanding) / Number(limit)) * 100)) : 0;

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Dashboard</h1>
            <p className="mt-1 font-mono text-sm text-fg-muted">{shortAddress(address, 6)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} loading={loading}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-bg-muted px-4 py-3 text-sm text-fg">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* KPI row — the numbers-you-need-right-now pattern: compact status
            cards rather than a chart-heavy view. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-5">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Credit limit</p>
              <InfoTip label="Max you can draw, based on your verified remittance history." />
            </div>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">${formatAmount(limit)}</p>
            <div className="mt-2"><Badge tone={eligible ? "success" : "muted"}>{eligible ? "Eligible" : "Not yet eligible"}</Badge></div>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Available</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">${formatAmount(available)}</p>
            <p className="mt-2 text-sm tabular-nums text-fg-secondary">${formatAmount(outstanding)} outstanding</p>
          </Card>
          <Card className="!p-5">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Risk score</p>
              <InfoTip label="Lower is better. Calculated from verified transfer patterns." />
            </div>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">{decision ? formatRisk(decision.riskScoreBps) : "—"}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Verified transfers</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">{transfers.length || preview?.stats?.transferCount || 0}</p>
            <p className="mt-2 text-sm tabular-nums text-fg-secondary">${formatAmount(preview?.stats?.totalAmount ?? "0")} total</p>
          </Card>
        </div>

        {Number(limit) > 0 && (
          <Card className="mt-4 !p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-fg">Credit used</p>
              <p className="text-sm tabular-nums text-fg-secondary">${formatAmount(outstanding)} <span className="text-fg-muted">/ ${formatAmount(limit)}</span></p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
              <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${utilizationPct}%` }} />
            </div>
          </Card>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted"><TrendingUp className="h-4 w-4 text-fg" /></div>
              <div>
                <CardTitle className="!text-base">Why this limit</CardTitle>
                <p className="mt-2 text-[12px] leading-relaxed text-fg-secondary whitespace-pre-line " >
                  {preview?.rationale || "Runs once verified remittances are recorded."}
                </p>
                <Link href="/credit" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:opacity-70">
                  Full breakdown <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardTitle className="!text-base">Quick actions</CardTitle>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/loans"><Button variant="primary" className="w-full" size="sm">Request or repay loan</Button></Link>
              <Link href="/remittances"><Button variant="outline" className="w-full" size="sm">View remittance history</Button></Link>
              <Link href="/onboarding"><Button variant="ghost" className="w-full" size="sm">Manage senders</Button></Link>
            </div>
          </Card>
        </div>

        {/* Financial-summary pattern: balance context + a short recent-
            transactions list, mirrored with a skeleton while refreshing. */}
        {(loading || transfers.length > 0) && (
          <Card className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <CardTitle className="!text-base">Recent remittances</CardTitle>
              <Link href="/remittances" className="text-sm font-medium text-fg-secondary transition hover:text-fg">View all</Link>
            </div>
            {loading && transfers.length === 0 ? (
              <SkeletonList rows={3} />
            ) : (
              <div className="divide-y divide-border">
                {transfers.slice(0, 5).map((t) => (
                  <div key={t.sourceTxHash} className="flex items-center justify-between py-3 transition-colors first:pt-0 last:pb-0 hover:bg-bg-muted/40">
                    <div>
                      <p className="text-sm font-medium tabular-nums text-fg">${formatAmount(t.amount)}</p>
                      <p className="font-mono text-xs text-fg-muted">from {shortAddress(t.sender)}</p>
                    </div>
                    <p className="text-xs text-fg-muted">{t.sourceTimestamp ? relativeTime(t.sourceTimestamp) : "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}