"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flower2, PhoneOutgoing, Terminal, Copy, type LucideIcon } from "lucide-react";
import AdminGrid from "../components/AdminGrid";
import DetailSection from "../components/DetailSection";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";



type Example = {

  label: string;
};

// Rotating proof points shown under the subheadline — swap/extend freely.
const EXAMPLES: Example[] = [
  { label: "Verified 12 transfers" },
  { label: "Credit line set to $1,400" },
  { label: "No bank statement required" },
];

const ROTATE_INTERVAL_MS = 3200;
const FADE_MS = 300;

function RotatingExample() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      const timeout = setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(timeout);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const { label } = EXAMPLES[index];

  return (
    <div
      className={`md:flex items-center justify-center gap-2 text-white/70 transition-opacity duration-300 ease-out hidden ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >

      <span className="text-sm font-medium md:text-[15px]">{label}</span>
    </div>
  );
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [email, setEmail] = useState("");

  // Respect reduced-motion preferences by freezing the background video.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      videoRef.current?.pause();
    }
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO: wire this up to your email capture endpoint / ESP.
    console.log("submitted email:", email);
    setEmail("");
  }

  return (
    <main className="relative w-full">
      <section className="relative h-[100dvh] w-full overflow-hidden bg-neutral-900">
        {/* Background video */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/videos/9198272-hd_1920_1080_25fps.mp4" type="video/mp4" />
        </video>

        {/* Darkening overlay for text legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/55" />

        {/* Nav */}
        <header className="fixed inset-x-0 top-5 z-[100] flex justify-center px-4 md:top-6">
          <nav className="flex items-center gap-1.5 rounded-md bg-white/10 p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.15)] ring-1 ring-white/25 backdrop-blur-md">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 md:px-5 md:py-2.5 md:text-[15px]"
            >

              <span className="font-[family-name:var(--font-serif)] italic">RemitCredit</span>
            </Link>

            <Link
              href="/company"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px]"
            >
              Company
            </Link>

            <Link
              href="/demo"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px]"
            >
              Demo
            </Link>

            <Link
              href="/onboarding"
              className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-black ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px] hidden md:block"
            >
              Login
            </Link>
          </nav>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-[42px] font-normal leading-[1.05] tracking-[-0.01em] text-white sm:text-[52px] md:text-[68px] lg:text-[78px]">
            Your remittances
            <br />
            <span className="italic">are real income.</span>
          </h1>

          <p className="mt-7 text-base font-medium text-white md:mt-8 md:text-xl">
          Now they unlock real credit.
          </p>

          {/* <div className="mt-4">
            <RotatingExample />
          </div> */}
        </div>

        {/* Email capture / login, pinned near the bottom of the hero */}
        <div
          className="absolute inset-x-0 z-30 flex justify-center px-4 bottom-40 md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="mt-4 flex flex-col items-center gap-3">
            <RotatingExample />

            <Link
              href="/onboarding"
              className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-black ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px] md:hidden block"
            >
              Check eligibility
            </Link>
          </div>
        </div>
      </section>

      <AdminGrid />
      <DetailSection />
      <FAQ />
      <Footer />
    </main>
  );
}