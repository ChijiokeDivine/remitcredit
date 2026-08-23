import type { Metadata } from "next";
import { Fraunces, Inter, Google_Sans } from "next/font/google";
import "./globals.css";
import React from "react";
import { Providers } from "@/components/providers";



// Serif display face for the headline ("You're a doctor. Not a machine.")
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  weight: ["400", "500"],
  display: "swap",
});

// Sans-serif face for nav, body copy, and form fields
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Sans-serif face for the hero headline ("You're a doctor. Not a machine.")
const googleSans = Google_Sans({
  subsets: ["latin"],
  fallback: ["Inter"],
  variable: "--font-google-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});



export const metadata: Metadata = {
  title: "RemitCredit — Verified remittances. Real credit.",
  description:
    "Turn your crypto remittance history into a credit line. No bank statements. No human underwriter.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${inter.variable} font-[family-name:var(--font-sans)] antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}