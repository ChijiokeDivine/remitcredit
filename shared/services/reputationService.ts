// shared/services/reputationService.ts
//
// Feature 2 — cross-corridor reputation aggregates + structuring heuristic.

import {
  senderReputationStore,
  type SenderReputation,
} from "./senderReputationStore";

export interface StructuringSignal {
  /** True when many recipients + small similar avg size suggests structuring. */
  flagged: boolean;
  recipientCount: number;
  avgTransferSize: string;
  ratio: number; // recipients / log10(avgSize+1) style score
  rationale: string;
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Detect structuring: high distinct recipients relative to average transfer size.
 * Thresholds configurable:
 *   STRUCTURING_MIN_RECIPIENTS (default 5)
 *   STRUCTURING_MAX_AVG_SIZE (default in token units as integer string comparison via BigInt)
 */
export function detectStructuring(rep: SenderReputation): StructuringSignal {
  const minRecipients = envNum("STRUCTURING_MIN_RECIPIENTS", 5);
  const maxAvg = BigInt(process.env.STRUCTURING_MAX_AVG_SIZE ?? "100000000"); // e.g. 100 USDC @ 6 dec

  const avg = BigInt(rep.avgTransferSize || "0");
  const recipientCount = rep.distinctRecipients;

  // ratio: more recipients + smaller avg → higher risk
  const ratio =
    avg === 0n
      ? recipientCount
      : Number(recipientCount) / Math.max(1, Math.log10(Number(avg > 10n ** 18n ? 10n ** 18n : avg) + 1));

  if (recipientCount >= minRecipients && avg > 0n && avg <= maxAvg) {
    return {
      flagged: true,
      recipientCount,
      avgTransferSize: rep.avgTransferSize,
      ratio,
      rationale: `Possible structuring: ${recipientCount} recipients with low average transfer size (${rep.avgTransferSize}).`,
    };
  }

  return {
    flagged: false,
    recipientCount,
    avgTransferSize: rep.avgTransferSize,
    ratio,
    rationale: "No structuring pattern detected from aggregate stats.",
  };
}

/** Ensure a global row exists when a sender is first declared anywhere. */
export async function ensureSenderReputation(
  sender: string,
  opts?: { nowSec?: number }
): Promise<SenderReputation> {
  const s = sender.toLowerCase();
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const existing = await senderReputationStore.get(s);
  if (existing) return existing;

  const fresh: SenderReputation = {
    sender: s,
    totalVerifiedRemittances: 0,
    distinctRecipients: 0,
    firstSeenAt: nowSec,
    totalVolume: "0",
    riskFlags: [],
    avgTransferSize: "0",
    updatedAt: nowSec,
  };
  await senderReputationStore.upsert(fresh);
  return fresh;
}

/**
 * Call when a new (sender, recipient) declaration is recorded.
 * Increments distinctRecipients if this is a new corridor for the sender.
 * Does NOT store which recipient — only the count.
 */
export async function onNewCorridor(
  sender: string,
  isNewPair: boolean,
  opts?: { nowSec?: number }
): Promise<SenderReputation> {
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  let rep = await ensureSenderReputation(sender, { nowSec });

  if (isNewPair) {
    rep = {
      ...rep,
      distinctRecipients: rep.distinctRecipients + 1,
      updatedAt: nowSec,
    };
    // Structuring check after increment
    const signal = detectStructuring(rep);
    if (signal.flagged && !rep.riskFlags.includes("STRUCTURING")) {
      rep.riskFlags = [...rep.riskFlags, "STRUCTURING"];
    }
    await senderReputationStore.upsert(rep);
  }
  return rep;
}

/**
 * Call after a transfer is counted as verified for scoring.
 */
export async function onVerifiedRemittance(
  sender: string,
  amount: string | bigint,
  opts?: { nowSec?: number }
): Promise<SenderReputation> {
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const s = sender.toLowerCase();
  let rep = await ensureSenderReputation(s, { nowSec });

  const amt = typeof amount === "bigint" ? amount : BigInt(amount || "0");
  const prevVol = BigInt(rep.totalVolume || "0");
  const nextCount = rep.totalVerifiedRemittances + 1;
  const nextVol = prevVol + amt;
  const avg = nextCount > 0 ? nextVol / BigInt(nextCount) : 0n;

  rep = {
    ...rep,
    totalVerifiedRemittances: nextCount,
    totalVolume: nextVol.toString(),
    avgTransferSize: avg.toString(),
    updatedAt: nowSec,
  };

  const signal = detectStructuring(rep);
  if (signal.flagged && !rep.riskFlags.includes("STRUCTURING")) {
    rep.riskFlags = [...rep.riskFlags, "STRUCTURING"];
  }

  await senderReputationStore.upsert(rep);
  return rep;
}

export async function addRiskFlag(sender: string, flag: string): Promise<void> {
  const rep = await ensureSenderReputation(sender);
  if (rep.riskFlags.includes(flag)) return;
  await senderReputationStore.upsert({
    ...rep,
    riskFlags: [...rep.riskFlags, flag],
    updatedAt: Math.floor(Date.now() / 1000),
  });
}

export async function getReputation(sender: string): Promise<SenderReputation | null> {
  return senderReputationStore.get(sender);
}
