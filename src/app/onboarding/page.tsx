// src/app/onboarding/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useWallet } from "../../lib/wallet";
import { registerBorrower, removeDeclaredSender, getBorrower, getDeclaredSenders, ApiError } from "../../lib/api";
import { isAddress } from "ethers";
import { Plus, X, Loader2, Check } from "lucide-react";

export default function OnboardingPage() {
  const { address, connect, isConnecting } = useWallet();
  const router = useRouter();
  const [senders, setSenders] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Whether this wallet is already registered on-chain, and whether we're
  // still checking. Starts `null` (unknown) so we don't flash "No senders
  // yet" for an already-registered wallet before the check resolves.
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Addresses already declared on-chain as of the last fetch, lowercased.
  // Removing one of these is a real, immediate contract call; removing a
  // row that isn't in this set is just local form state that was never
  // saved, so it's a plain in-memory edit.
  const [originalSenders, setOriginalSenders] = useState<string[]>([]);
  // Address currently mid-removal, so its row can show a spinner and be
  // disabled instead of allowing a double-submit.
  const [removingAddr, setRemovingAddr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setAlreadyRegistered(null);
      setOriginalSenders([]);
      return;
    }
    let cancelled = false;
    setCheckingStatus(true);
    (async () => {
      try {
        const record = await getBorrower(address);
        if (cancelled) return;
        if (record.registered) {
          const { declaredSenders } = await getDeclaredSenders(address);
          if (cancelled) return;
          setSenders(declaredSenders.length > 0 ? declaredSenders : [""]);
          setOriginalSenders(declaredSenders.map((s) => s.toLowerCase()));
          setAlreadyRegistered(true);
        } else {
          setAlreadyRegistered(false);
        }
      } catch {
        // Treat a failed status check as "unknown, assume not registered"
        // rather than blocking the page — worst case the backend's
        // idempotent registerBorrower route handles it correctly anyway.
        if (!cancelled) setAlreadyRegistered(false);
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const updateSender = (i: number, value: string) => setSenders((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  const addSender = () => setSenders((prev) => [...prev, ""]);

  const isPersisted = (value: string) => originalSenders.includes(value.trim().toLowerCase());

  // Per-row remove. A saved sender is removed on the contract immediately
  // (matching the page's existing "recorded on-chain instantly" framing);
  // an unsaved row is just dropped from local state — nothing to undo.
  const removeSender = async (i: number) => {
    const value = senders[i]?.trim() ?? "";
    if (!value || !isPersisted(value)) {
      setSenders((prev) => prev.filter((_, idx) => idx !== i));
      return;
    }
    if (!address) return;
    setError(null);
    setRemovingAddr(value.toLowerCase());
    try {
      await removeDeclaredSender(address, value);
      setSenders((prev) => prev.filter((_, idx) => idx !== i));
      setOriginalSenders((prev) => prev.filter((a) => a !== value.toLowerCase()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that sender. Try again.");
    } finally {
      setRemovingAddr(null);
    }
  };

  const validCount = senders.map((s) => s.trim()).filter(Boolean).length;
  // Only new, not-yet-persisted addresses actually need submitting — a
  // saved sender left untouched in the list shouldn't look like it's
  // pending a save it doesn't need.
  const pendingNewCount = senders.map((s) => s.trim()).filter((s) => s && !isPersisted(s)).length;

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
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">
            {alreadyRegistered ? "Manage your declared senders" : "Set up your credit"}
          </h1>
          <p className="mt-3 text-[15px] text-fg-secondary">
            {alreadyRegistered
              ? "These are the wallets currently declared for your account. Add or remove them anytime."
              : "Declare the wallets that send you support. Change them anytime."}
          </p>
        </div>
        {!address ? (
          <Card className="text-center">
            <CardTitle>Connect your wallet</CardTitle>
            <CardDescription>Your wallet is your identity. No email or password.</CardDescription>
            <Button className="mt-6 w-full" onClick={connect} loading={isConnecting}>Connect wallet</Button>
          </Card>
        ) : success ? (
          <Card className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Check className="h-5 w-5 text-accent" />
            </div>
            <CardTitle>{alreadyRegistered ? "Senders updated" : "You're registered"}</CardTitle>
            <CardDescription>Redirecting to your dashboard…</CardDescription>
          </Card>
        ) : checkingStatus ? (
          <Card>
            <div className="space-y-3">
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-2/3" />
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-medium text-fg">Your wallet</p>
                <p className="rounded-lg bg-bg-muted px-3 py-2.5 font-mono text-sm text-fg-secondary">{address}</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-fg">Declared senders</p>
                {senders.map((s, i) => {
                  const trimmed = s.trim();
                  const persisted = isPersisted(trimmed);
                  const isRemoving = persisted && removingAddr === trimmed.toLowerCase();
                  const showRemove = senders.length > 1 || persisted;
                  return (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="0x…"
                        value={s}
                        onChange={(e) => updateSender(i, e.target.value)}
                        className="font-mono text-sm"
                        disabled={isRemoving}
                      />
                      {showRemove && (
                        <button
                          type="button"
                          onClick={() => removeSender(i)}
                          disabled={isRemoving}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-fg-muted transition hover:bg-bg-muted hover:text-fg active:scale-95 disabled:pointer-events-none disabled:opacity-60"
                          aria-label={persisted ? "Remove sender on-chain" : "Remove sender"}
                        >
                          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addSender} className="flex items-center gap-1.5 text-sm font-medium text-accent transition hover:opacity-80">
                  <Plus className="h-4 w-4" /> Add another sender
                </button>
              </div>

              {/* Review-before-submit summary, matching the confirm-what's-
                  about-to-happen pattern used for card ordering and other
                  irreversible on-chain actions. Removals already happened
                  on-chain the moment each X was clicked, so this only
                  counts what "Save changes" would actually do. */}
              <div className="rounded-lg bg-bg-muted px-3.5 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                  {alreadyRegistered ? "This will add" : "You're about to register"}
                </p>
                <p className="mt-1 text-sm text-fg">
                  {alreadyRegistered
                    ? pendingNewCount > 0
                      ? `${pendingNewCount} new sender${pendingNewCount === 1 ? "" : "s"} · Recorded on-chain instantly`
                      : "No new senders to add"
                    : `${validCount > 0 ? `${validCount} sender${validCount === 1 ? "" : "s"}` : "No senders yet"} · Recorded on-chain instantly`}
                </p>
              </div>

              {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={validCount === 0 || (alreadyRegistered ? pendingNewCount === 0 : false)}
              >
                {alreadyRegistered ? "Save changes" : "Register & continue"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}