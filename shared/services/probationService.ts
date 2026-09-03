// shared/services/probationService.ts
//
// Feature 1 — probation state machine + ramped scoring weight.
// Thresholds are ALWAYS read from env at runtime (demo vs production).

import {
  senderProbationStore,
  type ProbationRecord,
  type ProbationStatus,
} from "./senderProbationStore";
import { senderReputationStore } from "./senderReputationStore";

export interface ProbationConfig {
  /** Minimum elapsed days (or fractional via PROBATION_MIN_SECONDS override). */
  minDays: number;
  minTransfers: number;
  /**
   * Optional absolute minimum seconds. When set, takes precedence over
   * minDays * 86400 — useful for testnet (e.g. 120 seconds).
   */
  minSeconds?: number;
  /**
   * Weight tiers as progress fractions (0–1) of BOTH criteria → weight bps.
   * Default: 0% progress → 2500, 50% → 5000, 100% → 10000.
   */
  weightTiers: Array<{ progress: number; weightBps: number }>;
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Load thresholds from env — never hardcode production values in logic. */
export function loadProbationConfig(): ProbationConfig {
  const minSecondsEnv = process.env.PROBATION_MIN_SECONDS;
  return {
    minDays: envNum("PROBATION_MIN_DAYS", 30),
    minTransfers: envNum("PROBATION_MIN_TRANSFERS", 5),
    minSeconds:
      minSecondsEnv !== undefined && minSecondsEnv !== ""
        ? Number(minSecondsEnv)
        : undefined,
    weightTiers: [
      { progress: 0, weightBps: 2500 },
      { progress: 0.5, weightBps: 5000 },
      { progress: 1, weightBps: 10000 },
    ],
  };
}

function requiredSeconds(cfg: ProbationConfig): number {
  if (cfg.minSeconds !== undefined && Number.isFinite(cfg.minSeconds)) {
    return cfg.minSeconds;
  }
  return cfg.minDays * 86400;
}

/**
 * Continuous progress in [0, 1] = min(timeProgress, countProgress).
 * Both criteria must advance — prevents gaming via dust OR waiting alone.
 */
export function computeProgress(
  record: Pick<ProbationRecord, "declaredAt" | "verifiedTransferCount">,
  cfg: ProbationConfig = loadProbationConfig(),
  nowSec: number = Math.floor(Date.now() / 1000)
): number {
  const elapsed = Math.max(0, nowSec - record.declaredAt);
  const timeProg = Math.min(1, elapsed / Math.max(1, requiredSeconds(cfg)));
  const countProg = Math.min(
    1,
    record.verifiedTransferCount / Math.max(1, cfg.minTransfers)
  );
  return Math.min(timeProg, countProg);
}

/**
 * Map progress to weight using tier breakpoints (linear interpolate between).
 * Explainable: "this sender is 60% trusted based on tenure".
 */
export function computeWeightBps(
  progress: number,
  cfg: ProbationConfig = loadProbationConfig()
): number {
  const tiers = [...cfg.weightTiers].sort((a, b) => a.progress - b.progress);
  if (progress <= tiers[0].progress) return tiers[0].weightBps;
  for (let i = 1; i < tiers.length; i++) {
    if (progress <= tiers[i].progress) {
      const prev = tiers[i - 1];
      const next = tiers[i];
      const span = next.progress - prev.progress;
      const t = span === 0 ? 1 : (progress - prev.progress) / span;
      return Math.round(prev.weightBps + t * (next.weightBps - prev.weightBps));
    }
  }
  return tiers[tiers.length - 1].weightBps;
}

export function shouldGraduate(
  record: Pick<ProbationRecord, "declaredAt" | "verifiedTransferCount" | "status">,
  cfg: ProbationConfig = loadProbationConfig(),
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  if (record.status === "flagged") return false;
  const elapsed = nowSec - record.declaredAt;
  return (
    elapsed >= requiredSeconds(cfg) &&
    record.verifiedTransferCount >= cfg.minTransfers
  );
}

/**
 * On declaration: create or refresh probation row.
 * Strong global reputation can shorten probation (reduce effective thresholds).
 */
export async function onSenderDeclared(
  sender: string,
  recipient: string,
  opts?: { nowSec?: number; cfg?: ProbationConfig }
): Promise<ProbationRecord> {
  const cfg = opts?.cfg ?? loadProbationConfig();
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const s = sender.toLowerCase();
  const r = recipient.toLowerCase();

  const existing = await senderProbationStore.get(s, r);
  if (existing) {
    // Re-declaration: keep history, refresh weight
    const progress = computeProgress(existing, cfg, nowSec);
    const weightBps = computeWeightBps(progress, cfg);
    const status: ProbationStatus =
      existing.status === "flagged"
        ? "flagged"
        : shouldGraduate(existing, cfg, nowSec)
          ? "active"
          : "probation";
    const updated: ProbationRecord = {
      ...existing,
      status,
      weightBps,
      updatedAt: nowSec,
    };
    await senderProbationStore.upsert(updated);
    return updated;
  }

  // New pair — check global reputation for shortened probation
  const rep = await senderReputationStore.get(s);
  let declaredAt = nowSec;
  let verifiedTransferCount = 0;
  let status: ProbationStatus = "probation";
  let weightBps = computeWeightBps(0, cfg);

  if (rep && rep.totalVerifiedRemittances > 0) {
    // Credit prior verified volume toward graduation (capped at minTransfers)
    const credit = Math.min(
      rep.totalVerifiedRemittances,
      cfg.minTransfers
    );
    verifiedTransferCount = credit;

    // If reputation already meets BOTH production-scale criteria globally,
    // start closer to active: backdate declaredAt so time progress is partial.
    if (
      rep.totalVerifiedRemittances >= cfg.minTransfers &&
      nowSec - rep.firstSeenAt >= requiredSeconds(cfg)
    ) {
      // Fully trusted corridor-crossing sender
      status = "active";
      weightBps = 10000;
      declaredAt = rep.firstSeenAt;
      verifiedTransferCount = Math.max(verifiedTransferCount, cfg.minTransfers);
    } else if (rep.totalVerifiedRemittances >= Math.ceil(cfg.minTransfers / 2)) {
      // Partial credit: treat as halfway through time window
      declaredAt = nowSec - Math.floor(requiredSeconds(cfg) / 2);
      const progress = computeProgress(
        { declaredAt, verifiedTransferCount },
        cfg,
        nowSec
      );
      weightBps = computeWeightBps(progress, cfg);
      if (shouldGraduate({ declaredAt, verifiedTransferCount, status: "probation" }, cfg, nowSec)) {
        status = "active";
        weightBps = 10000;
      }
    } else {
      const progress = computeProgress(
        { declaredAt, verifiedTransferCount },
        cfg,
        nowSec
      );
      weightBps = computeWeightBps(progress, cfg);
    }
  }

  const record: ProbationRecord = {
    sender: s,
    recipient: r,
    declaredAt,
    status,
    verifiedTransferCount,
    weightBps,
    updatedAt: nowSec,
  };
  await senderProbationStore.upsert(record);
  return record;
}

/**
 * On each verified transfer for a tracked pair:
 * look up status BEFORE mutating, increment count, maybe graduate, return weight.
 */
export async function onVerifiedTransfer(
  sender: string,
  recipient: string,
  opts?: { nowSec?: number; cfg?: ProbationConfig }
): Promise<{ record: ProbationRecord; weightBps: number; graduated: boolean }> {
  const cfg = opts?.cfg ?? loadProbationConfig();
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const s = sender.toLowerCase();
  const r = recipient.toLowerCase();

  let record = await senderProbationStore.get(s, r);
  if (!record) {
    // Transfer arrived before declaration row existed — bootstrap in probation
    record = await onSenderDeclared(s, r, { nowSec, cfg });
  }

  // Weight applied for THIS transfer is the pre-update weight
  const appliedWeight = record.weightBps;

  if (record.status === "flagged") {
    return { record, weightBps: 0, graduated: false };
  }

  const nextCount = record.verifiedTransferCount + 1;
  const next: ProbationRecord = {
    ...record,
    verifiedTransferCount: nextCount,
    updatedAt: nowSec,
  };

  let graduated = false;
  if (shouldGraduate(next, cfg, nowSec)) {
    next.status = "active";
    next.weightBps = 10000;
    graduated = record.status !== "active";
  } else {
    next.status = "probation";
    next.weightBps = computeWeightBps(computeProgress(next, cfg, nowSec), cfg);
  }

  await senderProbationStore.upsert(next);
  return { record: next, weightBps: appliedWeight, graduated };
}

export async function flagSenderPair(
  sender: string,
  recipient: string,
  reason?: string
): Promise<ProbationRecord | null> {
  const record = await senderProbationStore.get(sender, recipient);
  if (!record) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const updated: ProbationRecord = {
    ...record,
    status: "flagged",
    weightBps: 0,
    updatedAt: nowSec,
  };
  await senderProbationStore.upsert(updated);
  // Attach reason into reputation flags as well
  if (reason) {
    const rep = await senderReputationStore.get(sender);
    if (rep) {
      const flags = new Set(rep.riskFlags);
      flags.add(reason);
      await senderReputationStore.upsert({
        ...rep,
        riskFlags: [...flags],
        updatedAt: nowSec,
      });
    }
  }
  return updated;
}

export function explainWeight(record: ProbationRecord, cfg?: ProbationConfig): string {
  const c = cfg ?? loadProbationConfig();
  if (record.status === "flagged") {
    return "Sender is flagged; contributions are excluded from scoring.";
  }
  if (record.status === "active") {
    return "Sender has completed probation; full 100% weight applied.";
  }
  const progress = computeProgress(record, c);
  const pct = Math.round((record.weightBps / 10000) * 100);
  return `Sender is in probation (${Math.round(progress * 100)}% of graduation criteria). Scoring weight: ${pct}%. Needs ${c.minTransfers} verified transfers and ${c.minSeconds ?? c.minDays * 86400}s elapsed (both).`;
}
