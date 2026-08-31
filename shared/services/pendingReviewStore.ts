// shared/services/pendingReviewStore.ts
//
// Durable queue of borrowers awaiting an on-chain credit review. Uses
// Upstash Redis (REST — safe to call from the long-running worker without
// managing a persistent connection) when UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN are set, and falls back to an in-memory Set
// otherwise (fine for local dev without an Upstash project, but anything
// queued at crash time won't survive a restart in that mode).
//
// Entries are only removed once a review has actually landed on-chain (see
// AgentLoop.tick), so a crash mid-review just leaves the borrower in the
// set — the next process to boot picks up exactly where the last one left
// off.

import { Redis } from "@upstash/redis";

export interface PendingReviewStore {
  add(borrower: string): Promise<void>;
  remove(borrower: string): Promise<void>;
  list(): Promise<string[]>;
}

const PENDING_KEY = "worker:pendingReview";

class InMemoryPendingReviewStore implements PendingReviewStore {
  private set = new Set<string>();

  async add(borrower: string): Promise<void> {
    this.set.add(borrower.toLowerCase());
  }

  async remove(borrower: string): Promise<void> {
    this.set.delete(borrower.toLowerCase());
  }

  async list(): Promise<string[]> {
    return Array.from(this.set);
  }
}

class UpstashPendingReviewStore implements PendingReviewStore {
  constructor(private redis: Redis) {}

  async add(borrower: string): Promise<void> {
    await this.redis.sadd(PENDING_KEY, borrower.toLowerCase());
  }

  async remove(borrower: string): Promise<void> {
    await this.redis.srem(PENDING_KEY, borrower.toLowerCase());
  }

  async list(): Promise<string[]> {
    return await this.redis.smembers<string[]>(PENDING_KEY);
  }
}

function buildStore(): PendingReviewStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashPendingReviewStore(new Redis({ url, token }));
  }
  console.warn(
    "[pendingReviewStore] UPSTASH_REDIS_REST_URL/TOKEN not set — using an " +
      "in-memory queue. Borrowers awaiting review will be lost if the " +
      "worker restarts."
  );
  return new InMemoryPendingReviewStore();
}

const g = globalThis as unknown as { __remitPendingReviewStore?: PendingReviewStore };
if (!g.__remitPendingReviewStore) g.__remitPendingReviewStore = buildStore();
export const pendingReviewStore: PendingReviewStore = g.__remitPendingReviewStore;