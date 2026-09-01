// shared/services/checkpointStore.ts
//
// Tracks the last source-chain block fully scanned for remittance Transfer
// events. The standalone worker never needed this — a live listener just
// keeps state in memory for as long as the process runs. The Vercel-cron
// version has no long-lived process: every tick is a fresh invocation, so
// "where did we leave off" has to live in Redis instead.

import { Redis } from "@upstash/redis";

export interface CheckpointStore {
  get(): Promise<number | null>;
  set(blockNumber: number): Promise<void>;
}

const CHECKPOINT_KEY = "worker:lastScannedBlock";

class InMemoryCheckpointStore implements CheckpointStore {
  private value: number | null = null;
  async get(): Promise<number | null> {
    return this.value;
  }
  async set(blockNumber: number): Promise<void> {
    this.value = blockNumber;
  }
}

class UpstashCheckpointStore implements CheckpointStore {
  constructor(private redis: Redis) {}
  async get(): Promise<number | null> {
    const value = await this.redis.get<number>(CHECKPOINT_KEY);
    return value ?? null;
  }
  async set(blockNumber: number): Promise<void> {
    await this.redis.set(CHECKPOINT_KEY, blockNumber);
  }
}

function buildStore(): CheckpointStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashCheckpointStore(new Redis({ url, token }));
  }
  console.warn(
    "[checkpointStore] UPSTASH_REDIS_REST_URL/TOKEN not set — using an " +
      "in-memory checkpoint. On Vercel this resets on every cold start."
  );
  return new InMemoryCheckpointStore();
}

const g = globalThis as unknown as { __remitCheckpointStore?: CheckpointStore };
if (!g.__remitCheckpointStore) g.__remitCheckpointStore = buildStore();
export const checkpointStore: CheckpointStore = g.__remitCheckpointStore;