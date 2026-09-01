// src/app/loans/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { useWallet } from "../../lib/wallet";
import { useRepayApproval } from "../../lib/useRepayApproval";
import { getLoan, getCreditPreview, requestCreditReview, requestLoan, repayLoan, type LoanStatus, type CreditPreview, ApiError } from "../../lib/api";
import { formatAmount } from "../../lib/utils";
import { Banknote, ArrowDownLeft, ArrowUpRight, Sparkles, ShieldCheck } from "lucide-react";

export default function LoansPage() {
  const { address } = useWallet();
  const { needsApproval, approve, isSigning, isConfirming } = useRepayApproval();
  const [loan, setLoan] = useState<LoanStatus | null>(null);
  const [preview, setPreview] = useState<CreditPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [action, setAction] = useState<"request" | "repay" | null>(null);
  const [repayStep, setRepayStep] = useState<"approve" | "repay" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [loanRes, previewRes] = await Promise.allSettled([getLoan(address), getCreditPreview(address)]);
      if (loanRes.status === "fulfilled") setLoan(loanRes.value);
      if (previewRes.status === "fulfilled") setPreview(previewRes.value);
    } finally { setLoading(false); }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  // The on-chain limit only updates once a credit review is actually
  // submitted (see /credit's "Recheck limit"). Until then this stays $0
  // even if the off-chain preview says you're eligible for more — surface
  // that gap here instead of letting a "$0 available" look like a dead end.
  const handleUnlock = async () => {
    if (!address) return;
    setReviewing(true); setError(null); setMsg(null);
    try {
      await requestCreditReview(address);
      setMsg("Credit review submitted — your limit is now active on-chain.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Review failed.");
    } finally { setReviewing(false); }
  };

  const toUnits = (human: string): string => {
    const n = parseFloat(human);
    if (Number.isNaN(n) || n <= 0) throw new Error("Enter a positive amount");
    return String(Math.round(n * 1e6));
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setAction("request"); setError(null); setMsg(null);
    try {
      const res = await requestLoan(address, toUnits(requestAmount));
      setMsg(`Loan disbursed. Tx: ${res.txHash.slice(0, 10)}…`);
      setRequestAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Request failed.");
    } finally { setAction(null); }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setAction("repay"); setError(null); setMsg(null);
    try {
      const amountBaseUnits = toUnits(repayAmount);
      // repay() pulls tokens from the borrower's own wallet via
      // transferFrom, which only works once they've personally approved
      // the loan contract as a spender — that has to be signed by their
      // wallet, not the relayer, so it happens here before the relayer
      // call that actually records the repayment.
      if (needsApproval(BigInt(amountBaseUnits))) {
        setRepayStep("approve");
        await approve();
      }
      setRepayStep("repay");
      const res = await repayLoan(address, amountBaseUnits);
      setMsg(`Repayment recorded. Tx: ${res.txHash.slice(0, 10)}…`);
      setRepayAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Repayment failed.");
    } finally { setAction(null); setRepayStep(null); }
  };

  if (!address) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center">
          <Card><CardTitle>Connect your wallet</CardTitle><CardDescription>Request and repay against your credit line.</CardDescription></Card>
        </div>
      </AppShell>
    );
  }

  const limit = loan?.creditLimit ?? "0";
  const outstanding = loan?.outstandingPrincipal ?? "0";
  const available = loan?.availableCredit ?? "0";
  const hasLoan = Number(outstanding) > 0;
  const utilizationPct = Number(limit) > 0 ? Math.min(100, Math.round((Number(outstanding) / Number(limit)) * 100)) : 0;
  const initialLoading = loading && loan === null;

  // Eligible per the off-chain preview, but the on-chain limit is still 0
  // because no review has been submitted yet.
  const pendingLimit = preview?.decision?.creditLimit ?? "0";
  const hasPendingUpgrade = Number(limit) === 0 && (preview?.decision?.eligible ?? false) && Number(pendingLimit) > 0;

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-7">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Loans</h1>
          <p className="mt-2 text-[15px] text-fg-secondary">Draw against your verified credit line.</p>
        </div>

        {/* Balance summary card, mirrored while the first fetch is in flight. */}
        <Card className="mb-4">
          {initialLoading ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-3 w-20" />
                <Skeleton className="ml-auto h-8 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Outstanding balance</p>
                  {hasLoan && <Badge tone="outline">Active loan</Badge>}
                </div>
                <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">${formatAmount(outstanding)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Available</p>
                <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl tabular-nums text-fg">${formatAmount(available)}</p>
              </div>
            </div>
          )}
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
              <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${initialLoading ? 0 : utilizationPct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-fg-muted">
              <span>{initialLoading ? "—" : `${utilizationPct}% of $${formatAmount(limit)} limit used`}</span>
            </div>
          </div>
        </Card>

        {!initialLoading && hasPendingUpgrade && (
          <Card className="mb-4 border-accent/30 bg-accent/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10"><Sparkles className="h-4 w-4 text-accent" /></div>
                <div>
                  <p className="text-sm font-medium text-fg">You&apos;re eligible for ${formatAmount(pendingLimit)}</p>
                  <p className="mt-0.5 text-sm text-fg-secondary">Your credit review hasn&apos;t been submitted on-chain yet, so nothing&apos;s available to draw. Run it to activate this limit.</p>
                </div>
              </div>
              <Button size="sm" onClick={handleUnlock} loading={reviewing} className="shrink-0">Activate limit</Button>
            </div>
          </Card>
        )}

        {(msg || error) && <p className="mb-4 rounded-2xl border border-border bg-bg-muted px-4 py-3 text-sm text-fg">{error || msg}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted"><ArrowDownLeft className="h-4 w-4 text-fg" /></div>
              <div>
                <CardTitle className="!text-base">Request loan</CardTitle>
                <CardDescription>Up to ${formatAmount(available)} available.</CardDescription>
              </div>
            </div>
            <form onSubmit={handleRequest} className="space-y-4">
              <Input label="Amount (USD)" type="number" step="0.01" min="0" placeholder="100.00" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} />
              <Button type="submit" className="w-full" loading={action === "request"} disabled={!requestAmount}>
                <Banknote className="h-4 w-4" /> Request loan
              </Button>
            </form>
          </Card>
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted"><ArrowUpRight className="h-4 w-4 text-fg" /></div>
              <div>
                <CardTitle className="!text-base">Repay</CardTitle>
                <CardDescription>${formatAmount(outstanding)} outstanding.</CardDescription>
              </div>
            </div>
            <form onSubmit={handleRepay} className="space-y-4">
              <Input label="Amount (USD)" type="number" step="0.01" min="0" placeholder="50.00" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={() => setRepayAmount(formatAmount(outstanding).replace(/,/g, ""))} disabled={!hasLoan}>Full balance</Button>
              <Button type="submit" className="w-full" loading={action === "repay"} disabled={!repayAmount || !hasLoan}>
                {repayStep === "approve" && isSigning ? (
                  <><ShieldCheck className="h-4 w-4" /> Confirm in wallet…</>
                ) : repayStep === "approve" && isConfirming ? (
                  "Confirming approval…"
                ) : repayStep === "repay" ? (
                  "Repaying…"
                ) : (
                  "Repay"
                )}
              </Button>
              {repayStep === "approve" && (
                <p className="text-xs text-fg-muted">One-time approval — confirm the request in your wallet, then wait for it to confirm on-chain. You won&apos;t need to do this again.</p>
              )}
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}