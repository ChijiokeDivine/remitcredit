// shared/services/senderReputationStore.ts
//
// Feature 2 — cross-corridor reputation. Global registry keyed by sender_wallet.
// Privacy: only aggregate stats — no list of specific recipients.

import { Redis } from "@upstash/redis";

export interface SenderReputation {
  sender: string;
  /** Total verified remittances across all recipients. */
  totalVerifiedRemittances: number;
  /** Number of distinct recipients ever declared against. */
  distinctRecipients: number;
  /** Earliest first-seen (declaration or first verified transfer), unix seconds. */
  firstSeenAt: number;
  /** Aggregate verified volume in smallest units (string to avoid bigint JSON issues). */
  totalVolume: string;
  /** Any risk flags ever raised (string codes). */
  riskFlags: string[];
  /** Average transfer size (volume / count), string. */
  avgTransferSize: string;
  updatedAt: number;
}

export interface ReputationStore {
  get(sender: string): Promise<SenderReputation | null>;
  upsert(record: SenderReputation): Promise<void>;
}

const repKey = (sender: string) => `sender_rep:${sender.toLowerCase()}`;

class InMemoryReputationStore implements ReputationStore {
  private map = new Map<string, SenderReputation>();

  async get(sender: string): Promise<SenderReputation | null> {
    return this.map.get(sender.toLowerCase()) ?? null;
  }

  async upsert(record: SenderReputation): Promise<void> {
    this.map.set(record.sender.toLowerCase(), {
      ...record,
      sender: record.sender.toLowerCase(),
    });
  }
}

class UpstashReputationStore implements ReputationStore {
  constructor(private redis: Redis) {}

  async get(sender: string): Promise<SenderReputation | null> {
    const raw = await this.redis.get<string | SenderReputation>(repKey(sender));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as SenderReputation) : raw;
  }

  async upsert(record: SenderReputation): Promise<void> {
    const normalized = { ...record, sender: record.sender.toLowerCase() };
    await this.redis.set(repKey(normalized.sender), JSON.stringify(normalized));
  }
}

function buildStore(): ReputationStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashReputationStore(new Redis({ url, token }));
  return new InMemoryReputationStore();
}

const g = globalThis as unknown as { __senderReputationStore?: ReputationStore };
if (!g.__senderReputationStore) g.__senderReputationStore = buildStore();
export const senderReputationStore: ReputationStore = g.__senderReputationStore;
