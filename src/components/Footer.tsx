"use client";

import Link from "next/link";
import { Flower2 } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Product", href: "/demo" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    // This wrapper supplies the correct color for the corners outside the radius
    <div className="bg-[#F3F5F4]">
      <footer className="relative w-full rounded-t-[50px] md:rounded-t-[100px] bg-[#2F5D50] pt-20 pb-0 md:pt-28">
        <div className="mx-auto max-w-[1600px] px-6 md:px-10">
          {/* Top minimal row */}
          <div className="flex flex-col items-start justify-between gap-10 sm:flex-row sm:items-center">
            {/* Logo */}
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
            
              <span className="font-[family-name:var(--font-serif)]  text-xl tracking-tight text-white">
                RemitCredit
              </span>
            </Link>

            {/* Links */}
            <nav className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[15px] text-white/60 transition-colors duration-300 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Divider */}
          <div className="mt-14 h-px w-full bg-white/10 md:mt-16" />

          {/* Copyright */}
          <div className="mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} RemitCredit. All rights reserved.
            </p>
            <p className="text-sm text-white/40">
              Verified remittances. Real credit.
            </p>
          </div>
        </div>

        {/* Huge wordmark */}
        <div className="mt-16 overflow-hidden select-none md:mt-24">
          <p
            className="
              text-center
              font-[family-name:var(--font-serif)]
              text-[clamp(2.2rem,18vw,16rem)]
              font-normal
              leading-none
              tracking-[-0.04em]
              text-white/60
            "
          >
            RemitCredit
          </p>
        </div>
      </footer>
    </div>
  );
}