"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useWallet } from "../../lib/wallet";
import { getRemittances, getRemittanceStats, verifyRemittance, type VerifiedTransfer, ApiError } from "../../lib/api";
import { formatAmount, shortAddress, relativeTime } from "../../lib/utils";
import { ShieldCheck, Search } from "lucide-react";

export default function RemittancesPage() {
  const { address } = useWallet();
  const [transfers, setTransfers] = useState<VerifiedTransfer[]>([]);
  const [stats, setStats] = useState<{ transferCount: number; totalAmount: string; consistencyBps: number; lastTransferAt: number } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [rem, st] = await Promise.all([getRemittances(address), getRemittanceStats(address)]);
      setTransfers(rem.transfers ?? []);
      setStats(st.stats);
    } catch { /* offline */ } finally { setLoading(false); }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !txHash.trim()) return;
    setVerifying(true);
    setMsg(null);
    try {
      const res = await verifyRemittance(address, txHash.trim());
      setMsg(`Verified. On-chain tx: ${shortAddress(res.onchainTxHash, 6)}`);
      setTxHash("");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Verification failed.");
    } finally { setVerifying(false); }
  };

  if (!address) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md text-center">
          <Card><CardTitle>Connect your wallet</CardTitle><CardDescription>View verified remittance history.</CardDescription></Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-7">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Remittance history</h1>
          <p className="mt-2 text-[15px] text-fg-secondary">Every transfer proven on Creditcoin.</p>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Transfers</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-2xl text-fg">{stats?.transferCount ?? transfers.length}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Total verified</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-2xl text-fg">${formatAmount(stats?.totalAmount ?? "0")}</p>
          </Card>
          <Card className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Consistency</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-2xl text-fg">{stats?.consistencyBps != null ? `${(stats.consistencyBps / 100).toFixed(0)}%` : "—"}</p>
          </Card>
        </div>

        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted"><ShieldCheck className="h-4 w-4 text-fg" /></div>
            <div className="flex-1">
              <CardTitle className="!text-base">Verify a transfer</CardTitle>
              <CardDescription>Paste a source-chain tx hash to verify manually.</CardDescription>
              <form onSubmit={handleVerify} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input placeholder="0x… tx hash" value={txHash} onChange={(e) => setTxHash(e.target.value)} className="font-mono text-sm" />
                <Button type="submit" loading={verifying} className="shrink-0">Verify now</Button>
              </form>
              {msg && <p className="mt-3 text-sm text-fg-secondary">{msg}</p>}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle className="!text-base mb-4">Verified transfers</CardTitle>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Search className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={1.5} />
              <p className="text-sm text-fg-secondary">No verified transfers yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-fg-muted">
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Sender</th>
                    <th className="pb-3 pr-4 font-medium">When</th>
                    <th className="pb-3 font-medium">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transfers.map((t) => (
                    <tr key={t.sourceTxHash} className="transition-colors hover:bg-bg-muted/40">
                      <td className="py-3.5 pr-4 font-medium text-fg">${formatAmount(t.amount)}</td>
                      <td className="py-3.5 pr-4 font-mono text-xs text-fg-secondary">{shortAddress(t.sender, 5)}</td>
                      <td className="py-3.5 pr-4 text-fg-muted">{t.sourceTimestamp ? relativeTime(t.sourceTimestamp) : "—"}</td>
                      <td className="py-3.5 font-mono text-xs text-fg-secondary">{shortAddress(t.sourceTxHash, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
