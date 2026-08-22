"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useWallet } from "../../lib/wallet";
import { getLoan, requestLoan, repayLoan, type LoanStatus, ApiError } from "../../lib/api";
import { formatAmount } from "../../lib/utils";
import { Banknote, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function LoansPage() {
  const { address } = useWallet();
  const [loan, setLoan] = useState<LoanStatus | null>(null);
  const [requestAmount, setRequestAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [action, setAction] = useState<"request" | "repay" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    try { setLoan(await getLoan(address)); } catch { /* offline */ }
  }, [address]);

  useEffect(() => { load(); }, [load]);

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
      const res = await repayLoan(address, toUnits(repayAmount));
      setMsg(`Repayment recorded. Tx: ${res.txHash.slice(0, 10)}…`);
      setRepayAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Repayment failed.");
    } finally { setAction(null); }
  };

  if (!address) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center">
          <Card><CardTitle>Connect your wallet</CardTitle><CardDescription>Request and repay loans against your credit line.</CardDescription></Card>
        </div>
      </AppShell>
    );
  }

  const limit = loan?.creditLimit ?? "0";
  const outstanding = loan?.outstandingPrincipal ?? "0";
  const available = loan?.availableCredit ?? "0";

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Loans</h1>
          <p className="mt-2 text-[15px] text-fg-secondary">Draw against your verified remittance credit line.</p>
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Credit limit</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-fg">${formatAmount(limit)}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Available</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-fg">${formatAmount(available)}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Outstanding</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-fg">${formatAmount(outstanding)}</p>
            {Number(outstanding) > 0 && <Badge tone="outline" className="mt-2">Active loan</Badge>}
          </Card>
        </div>
        {(msg || error) && <p className="mb-6 rounded-[16px] bg-bg-muted px-4 py-3 text-sm text-fg">{error || msg}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted"><ArrowDownLeft className="h-4 w-4 text-fg" /></div>
              <div>
                <CardTitle className="!text-base">Request loan</CardTitle>
                <CardDescription>Draw down up to ${formatAmount(available)} available.</CardDescription>
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
                <CardDescription>Outstanding balance: ${formatAmount(outstanding)}</CardDescription>
              </div>
            </div>
            <form onSubmit={handleRepay} className="space-y-4">
              <Input label="Amount (USD)" type="number" step="0.01" min="0" placeholder="50.00" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={() => setRepayAmount(formatAmount(outstanding).replace(/,/g, ""))} disabled={Number(outstanding) === 0}>Full balance</Button>
              <Button type="submit" className="w-full" loading={action === "repay"} disabled={!repayAmount || Number(outstanding) === 0}>Repay</Button>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
