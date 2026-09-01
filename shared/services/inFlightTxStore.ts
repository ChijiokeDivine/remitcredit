// shared/services/inFlightTxStore.ts
//
// Tracks transactions that have been broadcast but not yet confirmed,
// split by `kind` since each needs different follow-up once mined: a
// confirmed "proof" tx queues the borrower for review; a confirmed
// "review" tx just gets cleared. This exists because the tick route can't
// block on tx.wait() inside one invocation (Vercel's execution-time
// ceiling) — it sends the tx, records it here, and a later tick checks
// whether it's been mined.

import { Redis } from "@upstash/redis";

export type InFlightKind = "proof" | "review";

export interface InFlightTx {
  txHash: string;
  borrower: string;
  sourceTxHash?: string; // only set for kind "proof"
  submittedAt: number;
}

export interface InFlightTxStore {
  add(kind: InFlightKind, entry: InFlightTx): Promise<void>;
  remove(kind: InFlightKind, txHash: string): Promise<void>;
  list(kind: InFlightKind): Promise<InFlightTx[]>;
}

const keyFor = (kind: InFlightKind) => `worker:inflight:${kind}`;

class InMemoryInFlightTxStore implements InFlightTxStore {
  private byKind = new Map<InFlightKind, Map<string, InFlightTx>>();

  private mapFor(kind: InFlightKind): Map<string, InFlightTx> {
    let m = this.byKind.get(kind);
    if (!m) {
      m = new Map();
      this.byKind.set(kind, m);
    }
    return m;
  }

  async add(kind: InFlightKind, entry: InFlightTx): Promise<void> {
    this.mapFor(kind).set(entry.txHash, entry);
  }
  async remove(kind: InFlightKind, txHash: string): Promise<void> {
    this.mapFor(kind).delete(txHash);
  }
  async list(kind: InFlightKind): Promise<InFlightTx[]> {
    return Array.from(this.mapFor(kind).values());
  }
}

class UpstashInFlightTxStore implements InFlightTxStore {
  constructor(private redis: Redis) {}

  async add(kind: InFlightKind, entry: InFlightTx): Promise<void> {
    await this.redis.hset(keyFor(kind), { [entry.txHash]: JSON.stringify(entry) });
  }
  async remove(kind: InFlightKind, txHash: string): Promise<void> {
    await this.redis.hdel(keyFor(kind), txHash);
  }
  async list(kind: InFlightKind): Promise<InFlightTx[]> {
    const raw = await this.redis.hgetall<Record<string, string>>(keyFor(kind));
    if (!raw) return [];
    return Object.values(raw).map((v) =>
      typeof v === "string" ? JSON.parse(v) : (v as unknown as InFlightTx)
    );
  }
}

function buildStore(): InFlightTxStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashInFlightTxStore(new Redis({ url, token }));
  }
  console.warn(
    "[inFlightTxStore] UPSTASH_REDIS_REST_URL/TOKEN not set — using an " +
      "in-memory store. In-flight transactions will be forgotten on every cold start."
  );
  return new InMemoryInFlightTxStore();
}

const g = globalThis as unknown as { __remitInFlightTxStore?: InFlightTxStore };
if (!g.__remitInFlightTxStore) g.__remitInFlightTxStore = buildStore();
export const inFlightTxStore: InFlightTxStore = g.__remitInFlightTxStore;