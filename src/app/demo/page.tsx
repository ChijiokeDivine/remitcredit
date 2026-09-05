"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Gauge,
  History,
  Info,
  Landmark,
  Link2,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { Button } from "../../components/ui/Button";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";

/* -------------------------------------------------------------------------- */
/*  Demo data - realistic fake numbers that feel like a real user journey     */
/* -------------------------------------------------------------------------- */

const DEMO = {
  borrower: {
    name: "Ada Okafor",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    short: "0x742d…bEb0",
  },
  senders: [
    {
      label: "Uncle in London",
      address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      short: "0x8ba1…BA72",
    },
    {
      label: "Sister in Toronto",
      address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      short: "0xAb58…eC9B",
    },
  ],
  transfers: [
    {
      id: "tx-1",
      from: "0x8ba1…BA72",
      amount: 420,
      date: "12 Aug 2026",
      status: "proven" as const,
      proofTx: "0x9f3a…c21d",
      height: 18_442_901,
    },
    {
      id: "tx-2",
      from: "0xAb58…eC9B",
      amount: 280,
      date: "28 Aug 2026",
      status: "proven" as const,
      proofTx: "0x7c1e…a90b",
      height: 18_510_334,
    },
    {
      id: "tx-3",
      from: "0x8ba1…BA72",
      amount: 450,
      date: "4 Sep 2026",
      status: "proven" as const,
      proofTx: "0x2d88…f41e",
      height: 18_561_112,
    },
  ],
  credit: {
    limit: 1000,
    available: 1000,
    risk: "Low",
    transferCount: 3,
    totalInflow: 1150,
    consistency: 92,
    lookbackDays: 90,
  },
  loan: {
    drawn: 600,
    remaining: 600,
    dueInDays: 21,
  },
};

/* -------------------------------------------------------------------------- */
/*  Step definitions                                                          */
/* -------------------------------------------------------------------------- */

type StepId =
  | "welcome"
  | "declare"
  | "remittance"
  | "attestcoin"
  | "decision"
  | "credit-live"
  | "borrow"
  | "repay"
  | "recap";

interface Step {
  id: StepId;
  number: string;
  title: string;
  shortLabel: string;
}

const STEPS: Step[] = [
  { id: "welcome", number: "0", title: "Welcome to the demo", shortLabel: "Welcome" },
  { id: "declare", number: "1", title: "Declare your senders", shortLabel: "Declare" },
  { id: "remittance", number: "2", title: "A remittance arrives", shortLabel: "Transfer" },
  { id: "attestcoin", number: "3", title: "Attestcoin proves it", shortLabel: "Attestcoin" },
  { id: "decision", number: "4", title: "Credit decision runs", shortLabel: "Decision" },
  { id: "credit-live", number: "5", title: "Your credit line is live", shortLabel: "Credit" },
  { id: "borrow", number: "6", title: "Borrow against the line", shortLabel: "Borrow" },
  { id: "repay", number: "7", title: "Repay and grow", shortLabel: "Repay" },
  { id: "recap", number: "8", title: "What you just saw", shortLabel: "Recap" },
];

/* -------------------------------------------------------------------------- */
/*  Small UI helpers                                                          */
/* -------------------------------------------------------------------------- */

function DemoNav() {
  return (
    <header className="fixed inset-x-0 top-5 z-[100] flex justify-center px-4 md:top-6">
      <nav className="flex items-center gap-1.5 rounded-md bg-bg-elevated/80 p-1.5 shadow-[var(--card-shadow)] ring-1 ring-border backdrop-blur-md">
        <Link
          href="/"
          className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 md:px-5 md:py-2.5"
        >
          <span className="font-[family-name:var(--font-serif)] italic">RemitCredit</span>
        </Link>
        <Link
          href="/company"
          className="rounded-md px-4 py-2 text-sm font-medium text-fg-secondary transition hover:bg-bg-muted hover:text-fg md:px-5 md:py-2.5"
        >
          Company
        </Link>
        <Link
          href="/onboarding"
          className="rounded-md px-4 py-2 text-sm font-medium text-fg-secondary transition hover:bg-bg-muted hover:text-fg md:px-5 md:py-2.5"
        >
          Dashboard
        </Link>
        <Link
          href="/demo"
          className="rounded-md bg-bg-muted px-4 py-2 text-sm font-medium text-fg md:px-5 md:py-2.5"
        >
          Demo
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">{children}</p>
  );
}

function MockScreen({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-border bg-bg-muted/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
         
          <span className="text-xs font-medium text-fg-secondary">{title}</span>
        </div>
        {badge && <Badge tone="success">{badge}</Badge>}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

function Callout({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "accent" | "warning";
}) {
  const tones = {
    default: "border-border bg-bg-muted/50",
    accent: "border-accent/30 bg-accent/5",
    warning: "border-warning-fg/20 bg-warning-bg/40",
  };
  return (
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
          <Icon className="h-4 w-4 text-fg" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-medium text-fg">{title}</p>
          <div className="mt-1 text-xs leading-relaxed text-fg-secondary">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ProgressRail({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-28 space-y-1">
        <SectionLabel>Journey</SectionLabel>
        <ol className="mt-3 space-y-0.5">
          {STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    active && "bg-accent/10 text-accent",
                    done && !active && "text-fg-secondary hover:bg-bg-muted",
                    !done && !active && "text-fg-muted hover:bg-bg-muted hover:text-fg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      active && "bg-accent text-accent-fg",
                      done && !active && "bg-fg text-bg",
                      !done && !active && "bg-bg-muted text-fg-muted"
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : s.number}
                  </span>
                  <span className="truncate font-medium">{s.shortLabel}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step content panels                                                       */
/* -------------------------------------------------------------------------- */

function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">
          Interactive demo - no wallet needed
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-fg-secondary">
          This guided demo walks you through every step a real user takes, using realistic fake
          data. Nothing touches a real wallet, chain, or API. You can go at your own pace and
          jump between steps.
        </p>
      </div>
      <Callout icon={Landmark} title="Meet our demo user" tone="accent">
        <p>
          You will follow <strong className="text-fg">Ada Okafor</strong> (
          <span className="font-mono text-xs">{DEMO.borrower.short}</span>). She regularly
          receives support from family abroad. RemitCredit turns that history into a credit line
          she can actually use.
        </p>
      </Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="!p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted">
            <ShieldCheck className="h-4.5 w-4.5 text-fg" strokeWidth={1.75} />
          </div>
          <CardTitle className="mt-3 !text-base">Looks real</CardTitle>
          <CardDescription>
            Screens, numbers, and copy mirror the live app so judges and visitors get an accurate
            feel of the product.
          </CardDescription>
        </Card>
        <Card className="!p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted">
            <Sparkles className="h-4.5 w-4.5 text-fg" strokeWidth={1.75} />
          </div>
          <CardTitle className="mt-3 !text-base">Attestcoin</CardTitle>
          <CardDescription>
            Every remittance that counts is verified on Creditcoin with Attestcoin - cryptographic proof checked on-chain, with no bridge and no third-party oracle.
          </CardDescription>
        </Card>
        <Card className="!p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted">
            <Info className="h-4.5 w-4.5 text-fg" strokeWidth={1.75} />
          </div>
          <CardTitle className="mt-3 !text-base">Clear at every step</CardTitle>
          <CardDescription>
           Each stage shows what is happening and why it matters, so you can follow the full path from first transfer to a live credit line.
          </CardDescription>
        </Card>
        <Card className="!p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted">
            <Wallet className="h-4.5 w-4.5 text-fg" strokeWidth={1.75} />
          </div>
          <CardTitle className="mt-3 !text-base">No wallet required</CardTitle>
          <CardDescription>
            Perfect for exploring the flow without connecting MetaMask or holding test tokens.
          </CardDescription>
        </Card>
      </div>


    </div>
  );
}

function DeclareStep() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 01</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            Declare the wallets that send you support
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            Ada tells RemitCredit which addresses send her money. She does this once. After that,
            every matching transfer is watched automatically - the senders do not need to change
            anything or install an app.
          </p>
        </div>

        <Callout icon={Info} title="Why this matters">
          Traditional credit asks for bank statements or payslips. Here the only “income signal”
          is on-chain transfers from declared senders. Declaring them is the onboarding step that
          starts the clock.
        </Callout>

        <Callout icon={Lock} title="What is recorded on-chain">
          The borrower address and the list of declared sender addresses are written to the
          RemittanceCreditRegistry contract on Creditcoin. That record is public and auditable.
        </Callout>
      </div>

      <MockScreen title="Onboarding · Declare senders" badge="Demo">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-fg-muted">Your wallet</p>
            <p className="mt-1 font-mono text-sm text-fg">{DEMO.borrower.address}</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-fg-muted">Declared senders</p>
            {DEMO.senders.map((s) => (
              <div
                key={s.address}
                className="flex items-center justify-between rounded-xl border border-border bg-bg px-3.5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-fg">{s.label}</p>
                  <p className="mt-0.5 font-mono text-xs text-fg-secondary">{s.short}</p>
                </div>
                <Badge tone="success">Saved</Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-bg-muted/80 px-3 py-2.5 text-xs text-fg-secondary">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
            Registered on Creditcoin · 2 senders declared
          </div>
        </div>
      </MockScreen>
    </div>
  );
}

function RemittanceStep() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 02</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            A remittance lands on the source chain
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            Uncle in London sends Ada 450 USDC on Ethereum (or Sepolia in test). The sender uses
            the same wallet and the same stablecoin they always use - no special RemitCredit
            transaction is required.
          </p>
        </div>

        <Callout icon={Zap} title="What the worker sees">
          A background worker watches the source chain for ERC-20 Transfer events into Ada&apos;s
          address from any declared sender. When one appears, it queues the transfer for
          cryptographic proof.
        </Callout>

        <Callout icon={History} title="No screenshots, no bank login">
          The system never asks Ada to upload a statement or connect a bank. The only evidence is
          the on-chain transfer itself, which will be proven in the next step.
        </Callout>
      </div>

      <MockScreen title="Incoming transfer detected" badge="Live">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-fg-muted">Detected transfer</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">$450.00</p>
              <p className="mt-1 text-sm text-fg-secondary">USDC · 4 Sep 2026</p>
            </div>
            <Badge tone="warning">Awaiting proof</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">From</p>
              <p className="mt-0.5 font-mono text-fg">0x8ba1…BA72</p>
            </div>
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">To (Ada)</p>
              <p className="mt-0.5 font-mono text-fg">{DEMO.borrower.short}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Worker preparing Attestcoin proof…
          </div>
        </div>
      </MockScreen>
    </div>
  );
}

function AttestcoinStep({ animPhase }: { animPhase: number }) {
  const phases = [
    { label: "Fetch block + tx data", desc: "Worker reads the source-chain block and the exact transfer." },
    { label: "Build Merkle proof", desc: "A Merkle path shows the transfer is inside that block’s transaction tree." },
    { label: "Build continuity proof", desc: "Roots link this block back to a known checkpoint so history can’t be faked." },
    { label: "Submit to Creditcoin", desc: "One transaction calls the Attestcoin precompile and records the proof." },
    { label: "Verified on-chain", desc: "The precompile accepts the proof. The remittance is now a first-class Creditcoin fact." },
  ];

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <SectionLabel>Step 03 · The heart of the product</SectionLabel>
        <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
          Creditcoin&apos;s Attestcoin Protocol proves the transfer
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
          This is the step that makes RemitCredit possible. Instead of trusting a centralized
          oracle or a bridge, RemitCredit uses <strong className="text-fg">Attestcoin</strong> -
          Creditcoin&apos;s native cross-chain verification precompile. The proof is checked
          on-chain in the same transaction that records the remittance.
        </p>
      </div>

      {/* Hero visual: pipeline */}
      <div className="grid gap-4 lg:grid-cols-5">
        {phases.map((p, i) => {
          const active = animPhase === i;
          const done = animPhase > i;
          return (
            <div
              key={p.label}
              className={cn(
                "relative rounded-xl border p-4 transition-all duration-300",
                active && "border-accent/40 bg-accent/5 shadow-[var(--card-shadow)]",
                done && "border-border bg-bg-elevated",
                !active && !done && "border-border/60 bg-bg-muted/30 opacity-70"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                    active && "bg-accent text-accent-fg",
                    done && "bg-fg text-bg",
                    !active && !done && "bg-bg-muted text-fg-muted"
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <p className="text-sm font-medium text-fg">{p.label}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{p.desc}</p>
              {i < phases.length - 1 && (
                <ChevronRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-fg-muted lg:block" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MockScreen title="Attestcoin verification · Creditcoin" badge="Proven">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <ShieldCheck className="h-5 w-5 text-accent" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">Transaction verified</p>
                <p className="text-xs text-fg-secondary">Precompile · 0x…0FD2</p>
              </div>
            </div>
            <div className="space-y-2 rounded-xl bg-bg-muted/70 p-3.5 font-mono text-[11px] leading-relaxed text-fg-secondary">
              <div className="flex justify-between gap-2">
                <span>chainKey</span>
                <span className="text-fg">1 (Ethereum / Sepolia)</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>height</span>
                <span className="text-fg">18,561,112</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>amount</span>
                <span className="text-fg">450 USDC</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>from → to</span>
                <span className="text-fg">0x8ba1… → Ada</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>proofTx</span>
                <span className="text-fg">0x2d88…f41e</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-secondary">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              Merkle + continuity proofs accepted · event emitted
            </div>
          </div>
        </MockScreen>

        <div className="space-y-4">
          <Callout icon={FileCheck2} title="What Attestcoin actually checks" tone="accent">
            <ul className="mt-1 list-inside list-disc space-y-1.5">
              <li>
                <strong className="text-fg">Merkle proof</strong> - the transfer is included in a
                specific block’s transaction tree.
              </li>
              <li>
                <strong className="text-fg">Continuity proof</strong> - that block connects to a
                known checkpoint so an attacker cannot invent history.
              </li>
              <li>
                Verification happens inside Creditcoin via a <strong className="text-fg">native
                precompile</strong> (fixed address). No external oracle, no bridge trust assumption.
              </li>
            </ul>
          </Callout>

          <Callout icon={Link2} title="Why this is different">
            Most “cross-chain” products rely on a multisig, a committee, or a light client that
            lives off-chain. Attestcoin makes the proof a first-class operation on Creditcoin
            itself. Once the precompile says “yes,” the rest of RemitCredit can treat the
            remittance as settled fact.
          </Callout>
        </div>
      </div>
    </div>
  );
}

function DecisionStep() {
  const rows = [
    { label: "Verified transfers (90d)", value: "3", target: "≥ 3", ok: true },
    { label: "Total proven inflow", value: "$1,150", target: "≥ $300", ok: true },
    { label: "Interval consistency", value: "92%", target: "higher is better", ok: true },
    { label: "Recency", value: "1 day ago", target: "recent activity", ok: true },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 04</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            A transparent rules engine sets the limit
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            Only transfers that survived Attestcoin verification are fed into the Credit Decision
            Engine. The engine is deterministic: same inputs always produce the same output. There
            is no black-box model and no human underwriter in the loop.
          </p>
        </div>

        <Callout icon={Gauge} title="Inputs are proven facts only">
          Transfer count, total inflow, regularity, and recency all come from the on-chain
          registry of Attestcoin-proven remittances. If a transfer was never proven, it simply
          does not exist for credit purposes.
        </Callout>

        <Callout icon={RefreshCw} title="Limits update automatically">
          When a new proof lands, Ada (or the system) can re-run the decision. The new limit is
          written back on-chain so anyone can audit the history of decisions.
        </Callout>
      </div>

      <MockScreen title="Credit decision engine" badge="Eligible">
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-fg-muted">Recommended limit</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-fg">
                ${DEMO.credit.limit.toLocaleString()}
              </p>
            </div>
            <Badge tone="success">{DEMO.credit.risk} risk</Badge>
          </div>
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-fg">{r.label}</p>
                  <p className="text-xs text-fg-muted">{r.target}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{r.value}</span>
                  {r.ok && <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg-secondary">
            Decision written to CreditDecisionEngine · transparent and replayable
          </p>
        </div>
      </MockScreen>
    </div>
  );
}

function CreditLiveStep() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 05</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            Ada’s credit line is live
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            The dashboard now shows a real limit built only from proven remittances. Ada can see
            every transfer that contributed, the decision inputs, and the available balance - all
            without a traditional credit file.
          </p>
        </div>

        <Callout icon={Sparkles} title="What the user experiences">
          From Ada’s point of view the product feels simple: “My family sends me money, and now I
          have a credit line.” Under the hood, every dollar of that line is backed by Attestcoin
          proofs on Creditcoin.
        </Callout>
      </div>

      <MockScreen title="Dashboard · Ada Okafor" badge="Live">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-bg-muted/80 p-3">
              <p className="text-[11px] text-fg-muted">Credit limit</p>
              <p className="mt-1 text-lg font-semibold text-fg">${DEMO.credit.limit}</p>
            </div>
            <div className="rounded-xl bg-bg-muted/80 p-3">
              <p className="text-[11px] text-fg-muted">Available</p>
              <p className="mt-1 text-lg font-semibold text-fg">${DEMO.credit.available}</p>
            </div>
            <div className="rounded-xl bg-bg-muted/80 p-3">
              <p className="text-[11px] text-fg-muted">Proven inflow</p>
              <p className="mt-1 text-lg font-semibold text-fg">${DEMO.credit.totalInflow}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">Recent proven remittances</p>
            <div className="space-y-2">
              {DEMO.transfers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-fg">${t.amount}</p>
                    <p className="text-xs text-fg-muted">
                      from {t.from} · {t.date}
                    </p>
                  </div>
                  <Badge tone="success">Proven</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MockScreen>
    </div>
  );
}

function BorrowStep() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 06</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            Borrow against the proven line
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            Ada draws $600 for short-term working capital. The loan contract checks that the
            request is within the current on-chain limit (itself derived from Attestcoin-proven
            history) and releases stablecoin.
          </p>
        </div>

        <Callout icon={Send} title="Still fully on-chain">
          Draw requests, outstanding balances, and repayments are recorded on Creditcoin. The
          credit line is not a soft off-chain number - it is enforced by the RemittanceMicroLoan
          contract.
        </Callout>
      </div>

      <MockScreen title="Loans · Draw funds" badge="Success">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-fg-muted">Amount drawn</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-fg">$600.00</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">Remaining limit</p>
              <p className="mt-0.5 font-medium text-fg">$800</p>
            </div>
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">Outstanding</p>
              <p className="mt-0.5 font-medium text-fg">$600</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-bg-muted/80 px-3 py-2.5 text-xs text-fg-secondary">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            Funds sent to Ada&apos;s wallet · loan recorded on Creditcoin
          </div>
        </div>
      </MockScreen>
    </div>
  );
}

function RepayStep() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-5">
        <div>
          <SectionLabel>Step 07</SectionLabel>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
            Repay - and the line keeps growing
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
            When Ada repays, capacity opens back up. New proven remittances continue to arrive
            and can raise the limit further. Good repayment history and steady inflow reinforce
            each other.
          </p>
        </div>

        <Callout icon={TrendingUp} title="A living credit relationship">
          Unlike a one-shot underwriting decision, RemitCredit is continuous. Every new
          Attestcoin-proven transfer can improve the picture. The product is designed for people
          whose income is recurring support from abroad - not a static salary file.
        </Callout>
      </div>

      <MockScreen title="Repayment confirmed" badge="Paid">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <CheckCircle2 className="h-5 w-5 text-accent" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">$600 repaid</p>
              <p className="text-xs text-fg-secondary">Outstanding balance is now $0</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">Credit limit</p>
              <p className="mt-0.5 font-medium text-fg">${DEMO.credit.limit}</p>
            </div>
            <div className="rounded-lg bg-bg-muted/80 px-3 py-2.5">
              <p className="text-xs text-fg-muted">Available again</p>
              <p className="mt-0.5 font-medium text-fg">${DEMO.credit.limit}</p>
            </div>
          </div>
          <p className="text-xs text-fg-secondary">
            Next proven remittance can raise the limit further.
          </p>
        </div>
      </MockScreen>
    </div>
  );
}

function RecapStep() {
  const points = [
    {
      title: "Declare once",
      body: "Ada named the wallets that support her. No special behaviour required from senders.",
    },
    {
      title: "Transfers are proven, not claimed",
      body: "Every dollar that counts went through Creditcoin’s Attestcoin Protocol - Merkle + continuity proofs checked by a native precompile.",
    },
    {
      title: "Transparent decision",
      body: "A rules engine used only proven data to set a $1,400 line. Inputs and outputs are on-chain.",
    },
    {
      title: "Borrow and repay on Creditcoin",
      body: "Draws and repayments are enforced by smart contracts. The relationship improves with more proven history.",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <SectionLabel>Step 08</SectionLabel>
        <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-normal tracking-tight text-fg md:text-3xl">
          What you just walked through
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">
          RemitCredit turns verified crypto remittances into usable credit. The piece that makes
          the whole system trustworthy is Creditcoin&apos;s Attestcoin Protocol - cryptographic
          proof that a transfer really happened, checked on-chain without a bridge or third-party
          oracle.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {points.map((p, i) => (
          <Card key={p.title} className="!p-5">
            <p className="font-mono text-xs text-fg-muted">0{i + 1}</p>
            <CardTitle className="mt-2 !text-base">{p.title}</CardTitle>
            <CardDescription>{p.body}</CardDescription>
          </Card>
        ))}
      </div>

      <Callout icon={ShieldCheck} title="Attestcoin is the foundation" tone="accent">
        <p>
          Without native, on-chain verification of cross-chain transfers, “remittance-backed
          credit” would rest on screenshots, oracles, or trust. Attestcoin lets RemitCredit treat
          each proven transfer as a first-class fact on Creditcoin - and build credit on top of
          that fact.
        </p>
      </Callout>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/onboarding">
          <Button size="lg">
            Try with your wallet <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/company">
          <Button variant="outline" size="lg">
            About the company
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function DemoPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [attestPhase, setAttestPhase] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  // Animate Attestcoin pipeline while on that step
  useEffect(() => {
    if (step.id !== "attestcoin") {
      setAttestPhase(0);
      return;
    }
    setAttestPhase(0);
    const id = setInterval(() => {
      setAttestPhase((p) => (p >= 4 ? 0 : p + 1));
    }, 1600);
    return () => clearInterval(id);
  }, [step.id]);

  // Optional auto-advance for “play demo”
  useEffect(() => {
    if (!autoPlaying) return;
    if (isLast) {
      setAutoPlaying(false);
      return;
    }
    const id = setTimeout(() => setStepIndex((i) => i + 1), step.id === "attestcoin" ? 9000 : 5500);
    return () => clearTimeout(id);
  }, [autoPlaying, stepIndex, isLast, step.id]);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, []);
  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);
  const jump = useCallback((i: number) => {
    setAutoPlaying(false);
    setStepIndex(i);
  }, []);

  const content = useMemo(() => {
    switch (step.id) {
      case "welcome":
        return <WelcomeStep />;
      case "declare":
        return <DeclareStep />;
      case "remittance":
        return <RemittanceStep />;
      case "attestcoin":
        return <AttestcoinStep animPhase={attestPhase} />;
      case "decision":
        return <DecisionStep />;
      case "credit-live":
        return <CreditLiveStep />;
      case "borrow":
        return <BorrowStep />;
      case "repay":
        return <RepayStep />;
      case "recap":
        return <RecapStep />;
      default:
        return null;
    }
  }, [step.id, attestPhase]);

  return (
    <main className="min-h-dvh bg-bg">
      <DemoNav />

      <div className="mx-auto max-w-6xl px-4 pb-28 pt-28 md:px-6 md:pt-36">
        {/* Top bar: progress + controls */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
      
            <p className="mt-1 text-sm text-fg-secondary">
              Step {stepIndex + 1} of {STEPS.length}
              <span className="mx-2 text-fg-muted">·</span>
              <span className="text-fg">{step.title}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!autoPlaying ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isLast) setStepIndex(0);
                  setAutoPlaying(true);
                }}
              >
                <Play className="h-3.5 w-3.5" />
                {isLast ? "Replay" : "Play through"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAutoPlaying(false)}>
                <Clock className="h-3.5 w-3.5" />
                Pause
              </Button>
            )}
          </div>
        </div>

        {/* Mobile step chips */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(i)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === stepIndex
                  ? "bg-accent text-accent-fg"
                  : i < stepIndex
                    ? "bg-fg text-bg"
                    : "bg-bg-muted text-fg-muted"
              )}
            >
              {s.shortLabel}
            </button>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
          <ProgressRail current={stepIndex} onJump={jump} />

          <div className="min-w-0">
            <div key={step.id} className="animate-fade-up">
              {content}
            </div>

            {/* Footer nav */}
            <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
              <Button variant="ghost" size="sm" onClick={goPrev} disabled={isFirst}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === stepIndex ? "w-6 bg-accent" : "w-1.5 bg-border-strong"
                    )}
                  />
                ))}
              </div>
              {!isLast ? (
                <Button size="sm" onClick={goNext}>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Link href="/onboarding">
                  <Button size="sm">
                    Start real onboarding
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
