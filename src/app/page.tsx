"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flower2, PhoneOutgoing, Terminal, Copy, type LucideIcon } from "lucide-react";

type Example = {
  icon: LucideIcon;
  label: string;
};

// Rotating proof points shown under the subheadline — swap/extend freely.
const EXAMPLES: Example[] = [
  { icon: PhoneOutgoing, label: "Called Cigna for claim status" },
  { icon: Terminal, label: "Booked 8 hygiene recalls" },
  { icon: Copy, label: "Closed the books for March" },
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

  const { icon: Icon, label } = EXAMPLES[index];

  return (
    <div
      className={`flex items-center justify-center gap-2 text-white/70 transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
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
    <main className="relative h-[100dvh] w-full overflow-hidden bg-neutral-900">
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
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* Darkening overlay for text legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/55" />

      {/* Nav */}
      <header className="fixed inset-x-0 top-5 z-30 flex justify-center px-4 md:top-6">
        <nav className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.15)] ring-1 ring-white/25 backdrop-blur-md">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 md:px-5 md:py-2.5 md:text-[15px]"
          >
            <Flower2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="font-[family-name:var(--font-serif)]">Lassie</span>
          </Link>

          <Link
            href="/company"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px]"
          >
            Company
          </Link>

          <Link
            href="/demo"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px]"
          >
            Demo
          </Link>

          <button
            type="button"
            className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:px-5 md:py-2.5 md:text-[15px]"
          >
            Login
          </button>
        </nav>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="font-[family-name:var(--font-serif)] text-[42px] font-normal leading-[1.05] tracking-[-0.01em] text-white sm:text-[52px] md:text-[68px] lg:text-[78px]">
          You’re a doctor.
          <br />
          <span className="italic">Not a machine.</span>
        </h1>

        <p className="mt-7 text-base font-medium text-white md:mt-8 md:text-xl">
          Let Lassie do your admin
        </p>

        <div className="mt-4">
          <RotatingExample />
        </div>
      </div>

      {/* Email capture, pinned near the bottom */}
      <div
        className="fixed inset-x-0 z-30 flex justify-center px-4"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-[420px] items-center gap-1 rounded-lg bg-white/10 p-1.5 ring-1 ring-white/25 backdrop-blur-md md:max-w-[460px]"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            aria-label="Your email"
            className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/70 md:px-5 md:py-3 md:text-[15px]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 md:px-6 md:py-3 md:text-[15px]"
          >
            Get started
          </button>
        </form>
      </div>
    </main>
  );
}