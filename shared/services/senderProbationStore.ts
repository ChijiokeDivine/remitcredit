// shared/services/senderProbationStore.ts
//
// Feature 1 — cool-down / probation period per (sender_wallet, recipient) pair.
// Off-chain only. Redis (Upstash REST) when configured, else in-memory.

import { Redis } from "@upstash/redis";

export type ProbationStatus = "probation" | "active" | "flagged";

export interface ProbationRecord {
  sender: string;
  recipient: string;
  declaredAt: number; // unix seconds
  status: ProbationStatus;
  verifiedTransferCount: number;
  /** Last computed weight in basis points (0–10000). */
  weightBps: number;
  updatedAt: number;
}

export interface ProbationStore {
  get(sender: string, recipient: string): Promise<ProbationRecord | null>;
  upsert(record: ProbationRecord): Promise<void>;
  listForRecipient(recipient: string, limit?: number): Promise<ProbationRecord[]>;
  listForSender(sender: string, limit?: number): Promise<ProbationRecord[]>;
}

const key = (sender: string, recipient: string) =>
  `probation:${sender.toLowerCase()}:${recipient.toLowerCase()}`;
const recipientIndex = (recipient: string) =>
  `probation:by_recipient:${recipient.toLowerCase()}`;
const senderIndex = (sender: string) =>
  `probation:by_sender:${sender.toLowerCase()}`;

class InMemoryProbationStore implements ProbationStore {
  private map = new Map<string, ProbationRecord>();

  async get(sender: string, recipient: string): Promise<ProbationRecord | null> {
    return this.map.get(key(sender, recipient)) ?? null;
  }

  async upsert(record: ProbationRecord): Promise<void> {
    this.map.set(key(record.sender, record.recipient), {
      ...record,
      sender: record.sender.toLowerCase(),
      recipient: record.recipient.toLowerCase(),
    });
  }

  async listForRecipient(recipient: string, limit = 100): Promise<ProbationRecord[]> {
    const r = recipient.toLowerCase();
    return [...this.map.values()]
      .filter((x) => x.recipient === r)
      .slice(0, limit);
  }

  async listForSender(sender: string, limit = 100): Promise<ProbationRecord[]> {
    const s = sender.toLowerCase();
    return [...this.map.values()]
      .filter((x) => x.sender === s)
      .slice(0, limit);
  }
}

class UpstashProbationStore implements ProbationStore {
  constructor(private redis: Redis) {}

  async get(sender: string, recipient: string): Promise<ProbationRecord | null> {
    const raw = await this.redis.get<string | ProbationRecord>(key(sender, recipient));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as ProbationRecord) : raw;
  }

  async upsert(record: ProbationRecord): Promise<void> {
    const normalized: ProbationRecord = {
      ...record,
      sender: record.sender.toLowerCase(),
      recipient: record.recipient.toLowerCase(),
    };
    const payload = JSON.stringify(normalized);
    const k = key(normalized.sender, normalized.recipient);
    await Promise.all([
      this.redis.set(k, payload),
      this.redis.sadd(recipientIndex(normalized.recipient), k),
      this.redis.sadd(senderIndex(normalized.sender), k),
    ]);
  }

  async listForRecipient(recipient: string, limit = 100): Promise<ProbationRecord[]> {
    const keys = await this.redis.smembers(recipientIndex(recipient));
    if (!keys?.length) return [];
    const out: ProbationRecord[] = [];
    for (const k of keys.slice(0, limit)) {
      const raw = await this.redis.get<string | ProbationRecord>(k);
      if (!raw) continue;
      out.push(typeof raw === "string" ? (JSON.parse(raw) as ProbationRecord) : raw);
    }
    return out;
  }

  async listForSender(sender: string, limit = 100): Promise<ProbationRecord[]> {
    const keys = await this.redis.smembers(senderIndex(sender));
    if (!keys?.length) return [];
    const out: ProbationRecord[] = [];
    for (const k of keys.slice(0, limit)) {
      const raw = await this.redis.get<string | ProbationRecord>(k);
      if (!raw) continue;
      out.push(typeof raw === "string" ? (JSON.parse(raw) as ProbationRecord) : raw);
    }
    return out;
  }
}

function buildStore(): ProbationStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashProbationStore(new Redis({ url, token }));
  return new InMemoryProbationStore();
}

const g = globalThis as unknown as { __senderProbationStore?: ProbationStore };
if (!g.__senderProbationStore) g.__senderProbationStore = buildStore();
export const senderProbationStore: ProbationStore = g.__senderProbationStore;
