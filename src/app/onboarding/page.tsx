"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useWallet } from "../../lib/wallet";
import { registerBorrower, ApiError } from "../../lib/api";
import { isAddress } from "ethers";
import { Plus, X, ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const { address, connect, isConnecting } = useWallet();
  const router = useRouter();
  const [senders, setSenders] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateSender = (i: number, value: string) => setSenders((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  const addSender = () => setSenders((prev) => [...prev, ""]);
  const removeSender = (i: number) => setSenders((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!address) { setError("Connect a wallet first."); return; }
    const valid = senders.map((s) => s.trim()).filter(Boolean);
    if (valid.length === 0) { setError("Add at least one sender address."); return; }
    for (const s of valid) {
      if (!isAddress(s)) { setError(`Invalid address: ${s}`); return; }
    }
    setLoading(true);
    try {
      const result = await registerBorrower(address, valid);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), Math.max(2500, 1200));
      void result;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status ? `[${err.status}] ` : ""}${err.message || "Registration failed."}`);
      } else if (err instanceof Error) {
        setError(err.message || "Something went wrong. Try again.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg animate-fade-up">
        <div className="mb-7 text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Set up your credit</h1>
          <p className="mt-3 text-[15px] text-fg-secondary">Declare the wallets that send you support. Change them anytime.</p>
        </div>
        {!address ? (
          <Card className="text-center">
            <CardTitle>Connect your wallet</CardTitle>
            <CardDescription>Your wallet is your identity. No email or password.</CardDescription>
            <Button className="mt-6 w-full" onClick={connect} loading={isConnecting}>Connect wallet</Button>
          </Card>
        ) : success ? (
          <Card className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-muted">
              <ArrowRight className="h-5 w-5 text-fg" />
            </div>
            <CardTitle>You&apos;re registered</CardTitle>
            <CardDescription>Redirecting to your dashboard…</CardDescription>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-medium text-fg">Your wallet</p>
                <p className="rounded-md bg-bg-muted px-3 py-2.5 font-mono text-sm text-fg-secondary">{address}</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-fg">Declared senders</p>
                {senders.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="0x…" value={s} onChange={(e) => updateSender(i, e.target.value)} className="font-mono text-sm" />
                    {senders.length > 1 && (
                      <button type="button" onClick={() => removeSender(i)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted transition hover:bg-bg-muted hover:text-fg active:scale-95" aria-label="Remove sender">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addSender} className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition hover:text-fg">
                  <Plus className="h-4 w-4" /> Add another sender
                </button>
              </div>
              {error && <p className="rounded-md bg-bg-muted px-3 py-2 text-sm text-fg">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>Register &amp; continue</Button>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
