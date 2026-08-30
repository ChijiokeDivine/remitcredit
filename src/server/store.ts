// src/server/store.ts
//
// Activity feed. Uses Upstash Redis (REST, so it's safe to call from
// serverless functions — no persistent connection to manage) when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, and falls back
// to the process-local in-memory store otherwise (handy for local dev
// without an Upstash project).
//
// Storage note: each event is a small JSON blob, so Upstash's free tier
// (256MB) comfortably holds hundreds of thousands of events. Lists are
// still capped via LTRIM below so growth stays bounded regardless of tier.

import { Redis } from "@upstash/redis";

export interface ActivityEvent {
  id: string;
  borrower: string;
  type:
    | "borrower_registered"
    | "remittance_verified"
    | "credit_reviewed"
    | "loan_disbursed"
    | "loan_repaid";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ActivityStore {
  append(event: Omit<ActivityEvent, "id" | "timestamp">): Promise<ActivityEvent> | ActivityEvent;
  listForBorrower(borrower: string, limit?: number): Promise<ActivityEvent[]> | ActivityEvent[];
  listAll(limit?: number): Promise<ActivityEvent[]> | ActivityEvent[];
}

// Cap per-list length so storage never grows unbounded, independent of tier.
const ALL_FEED_CAP = 2000;
const BORROWER_FEED_CAP = 500;
const ALL_KEY = "activity:all";
const borrowerKey = (borrower: string) => `activity:borrower:${borrower.toLowerCase()}`;
const counterKey = "activity:counter";

class InMemoryActivityStore implements ActivityStore {
  private events: ActivityEvent[] = [];
  private counter = 0;

  append(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent {
    const full: ActivityEvent = {
      ...event,
      id: `evt_${++this.counter}`,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.events.push(full);
    return full;
  }

  listForBorrower(borrower: string, limit = 50): ActivityEvent[] {
    const key = borrower.toLowerCase();
    return this.events
      .filter((e) => e.borrower.toLowerCase() === key)
      .slice(-limit)
      .reverse();
  }

  listAll(limit = 100): ActivityEvent[] {
    return this.events.slice(-limit).reverse();
  }
}

class UpstashActivityStore implements ActivityStore {
  constructor(private redis: Redis) {}

  async append(event: Omit<ActivityEvent, "id" | "timestamp">): Promise<ActivityEvent> {
    const id = await this.redis.incr(counterKey);
    const full: ActivityEvent = {
      ...event,
      id: `evt_${id}`,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const payload = JSON.stringify(full);

    // LPUSH keeps the newest event at index 0 in both lists; LTRIM bounds
    // storage regardless of how long the app has been running.
    await Promise.all([
      this.redis.lpush(ALL_KEY, payload).then(() => this.redis.ltrim(ALL_KEY, 0, ALL_FEED_CAP - 1)),
      this.redis
        .lpush(borrowerKey(event.borrower), payload)
        .then(() => this.redis.ltrim(borrowerKey(event.borrower), 0, BORROWER_FEED_CAP - 1)),
    ]);

    return full;
  }

  async listForBorrower(borrower: string, limit = 50): Promise<ActivityEvent[]> {
    const raw = await this.redis.lrange<string>(borrowerKey(borrower), 0, limit - 1);
    return parseAll(raw);
  }

  async listAll(limit = 100): Promise<ActivityEvent[]> {
    const raw = await this.redis.lrange<string>(ALL_KEY, 0, limit - 1);
    return parseAll(raw);
  }
}

// The Upstash SDK auto-deserializes JSON values in some configurations and
// returns raw strings in others depending on version — handle both so this
// doesn't silently break on an SDK bump.
function parseAll(raw: unknown[]): ActivityEvent[] {
  return raw.map((v) => (typeof v === "string" ? (JSON.parse(v) as ActivityEvent) : (v as ActivityEvent)));
}

function buildStore(): ActivityStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashActivityStore(new Redis({ url, token }));
  }
  // No Upstash config found — fall back to in-memory (fine for local dev;
  // on serverless deploys without these env vars you're back to the
  // per-instance memory issue this file exists to fix).
  return new InMemoryActivityStore();
}

const g = globalThis as unknown as { __remitActivityStore?: ActivityStore };
if (!g.__remitActivityStore) g.__remitActivityStore = buildStore();
export const activityStore: ActivityStore = g.__remitActivityStore;
