import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(
  value: string | number | bigint,
  decimals = 6,
  displayDecimals = 2
): string {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  if (Number.isNaN(n)) return "—";
  const scaled = n / 10 ** decimals;
  return scaled.toLocaleString("en-US", {
    minimumFractionDigits: displayDecimals,
    maximumFractionDigits: displayDecimals,
  });
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function relativeTime(ts: number | string): string {
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts * 1000;
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export function formatRisk(bps: number | string): string {
  const n = Number(bps);
  if (Number.isNaN(n)) return "—";
  return `${(n / 100).toFixed(1)}%`;
}
