"use client";
import Link from "next/link";
import Footer from "../../components/Footer";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export default function CompanyPage() {
  return (
    <main className="min-h-dvh bg-bg">
      <header className="fixed inset-x-0 top-5 z-[100] flex justify-center px-4 md:top-6">
        <nav className="flex items-center gap-1.5 rounded-md bg-bg-elevated/80 p-1.5 shadow-[var(--card-shadow)] ring-1 ring-border backdrop-blur-md">
          <Link href="/" className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 md:px-5 md:py-2.5">
            <span className="font-[family-name:var(--font-serif)] italic">RemitCredit</span>
          </Link>
          <Link href="/company" className="rounded-md bg-bg-muted px-4 py-2 text-sm font-medium text-fg md:px-5 md:py-2.5">Company</Link>
          <Link href="/demo" className="rounded-md px-4 py-2 text-sm font-medium text-fg-secondary transition hover:bg-bg-muted hover:text-fg md:px-5 md:py-2.5">Demo</Link>
          <ThemeToggle />
        </nav>
      </header>
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-32 md:pt-40">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl font-normal tracking-tight text-fg md:text-5xl">
          Built for the people<br /><span className="italic">credit systems ignore.</span>
        </h1>
        <div className="mt-12 space-y-8 text-[17px] leading-relaxed text-fg-secondary">
          <p>Millions receive regular support from family abroad — real, recurring income that never shows up on a bank statement or credit file. RemitCredit exists so that history can finally count.</p>
          <p>We use Creditcoin&apos;s Attestcoin Protocol to cryptographically prove each remittance happened, then feed that verified record into a transparent decision engine. No screenshots. No centralized oracle. No human underwriter.</p>
          <p>Creditcoin launched in 2017 as on-chain credit infrastructure for emerging-market micro-lending. RemitCredit extends that mission with a new income signal — crypto remittances — that wasn&apos;t verifiable until Attestcoin shipped.</p>
          <p>Built for BUIDL CTC 2026 Fall (AI track). The &quot;AI&quot; is an autonomous agent: it acts on freshly verified cross-chain data with zero human review. The scoring itself is deterministic and auditable by design.</p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
