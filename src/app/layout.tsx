import type { Metadata } from "next";
import { Fraunces, Inter, Google_Sans } from "next/font/google";
import "./globals.css";
import React from "react";

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
  title: "Lassie — You're a doctor. Not a machine.",
  description: "Let Lassie do your admin.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} ${googleSans.variable} font-[family-name:var(--font-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}