"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "../../components/Footer";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { Button } from "../../components/ui/Button";
import { Card, CardTitle, CardDescription } from "../../components/ui/Card";
import { useWallet } from "../../lib/wallet";
import { ArrowRight } from "lucide-react";

const STEPS = [
  { n: "01", title: "Connect & declare", body: "Link your wallet and name the addresses that send you support." },
  { n: "02", title: "Transfers are proven", body: "The worker detects remittances and submits Attestcoin proofs on Creditcoin." },
  { n: "03", title: "Limit is set", body: "A transparent rules engine reads your verified history and sets a credit line." },
  { n: "04", title: "Borrow & repay", body: "Draw against your line when you need working capital. Limit grows with history." },
];

export default function DemoPage() {
  const { address, isConnecting, setDemoAddress } = useWallet();
  const router = useRouter();
  const startDemo = async () => {
    if (!address) setDemoAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0");
    router.push("/dashboard");
  };
  return (
    <main className="min-h-dvh bg-bg">
      <header className="fixed inset-x-0 top-5 z-[100] flex justify-center px-4 md:top-6">
        <nav className="flex items-center gap-1.5 rounded-md bg-bg-elevated/80 p-1.5 shadow-[var(--card-shadow)] ring-1 ring-border backdrop-blur-md">
          <Link href="/" className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 md:px-5 md:py-2.5">
            <span className="font-[family-name:var(--font-serif)] italic">RemitCredit</span>
          </Link>
          <Link href="/company" className="rounded-md px-4 py-2 text-sm font-medium text-fg-secondary transition hover:bg-bg-muted hover:text-fg md:px-5 md:py-2.5">Company</Link>
          <Link href="/demo" className="rounded-md bg-bg-muted px-4 py-2 text-sm font-medium text-fg md:px-5 md:py-2.5">Demo</Link>
          <ThemeToggle />
        </nav>
      </header>
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-32 md:pt-40">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl font-normal tracking-tight text-fg md:text-5xl">See it end to end</h1>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-fg-secondary">
            Walk through the product with a demo wallet. All pages are live; backend writes need a running API and relayer key.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={startDemo} loading={isConnecting}>Open dashboard <ArrowRight className="h-4 w-4" /></Button>
            <Link href="/onboarding"><Button variant="outline" size="lg">Start onboarding</Button></Link>
          </div>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.n} className="!p-6">
              <p className="font-mono text-xs text-fg-muted">{s.n}</p>
              <CardTitle className="mt-2 !text-lg">{s.title}</CardTitle>
              <CardDescription>{s.body}</CardDescription>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
