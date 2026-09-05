// src/server/v1/redis.ts
import { Redis } from "@upstash/redis";

export type RedisLike = {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
};

class MemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; exp?: number }>();
  private purge(key: string) {
    const e = this.store.get(key);
    if (e?.exp && Date.now() > e.exp) this.store.delete(key);
  }
  async get<T = string>(key: string): Promise<T | null> {
    this.purge(key);
    const e = this.store.get(key);
    if (!e) return null;
    try { return JSON.parse(e.value) as T; } catch { return e.value as unknown as T; }
  }
  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null> {
    this.purge(key);
    if (opts?.nx && this.store.has(key)) return null;
    const exp = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
    this.store.set(key, { value, exp });
    return "OK";
  }
  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) { if (this.store.delete(k)) n++; }
    return n;
  }
  async incr(key: string): Promise<number> {
    this.purge(key);
    const cur = Number((await this.get<string>(key)) ?? "0") || 0;
    const next = cur + 1;
    await this.set(key, String(next));
    return next;
  }
}

class UpstashRedisAdapter implements RedisLike {
  constructor(private redis: Redis) {}
  async get<T = string>(key: string): Promise<T | null> {
    const v = await this.redis.get<T>(key);
    return v ?? null;
  }
  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null> {
    if (opts?.nx && opts?.ex) {
      const r = await this.redis.set(key, value, { nx: true, ex: opts.ex });
      return r as "OK" | null;
    }
    if (opts?.nx) {
      const r = await this.redis.set(key, value, { nx: true });
      return r as "OK" | null;
    }
    if (opts?.ex) {
      await this.redis.set(key, value, { ex: opts.ex });
      return "OK";
    }
    await this.redis.set(key, value);
    return "OK";
  }
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }
  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }
}

function build(): RedisLike {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashRedisAdapter(new Redis({ url, token }));
  return new MemoryRedis();
}

const g = globalThis as unknown as { __remitV1Redis?: RedisLike };
if (!g.__remitV1Redis) g.__remitV1Redis = build();
export const redis: RedisLike = g.__remitV1Redis;

export const Keys = {
  nonce: (address: string, nonce: string) => `api:v1:nonce:${address.toLowerCase()}:${nonce}`,
  session: (token: string) => `api:v1:session:${token}`,
  sessionsByAddress: (address: string) => `api:v1:sessions:${address.toLowerCase()}`,
  idempotency: (address: string, key: string) => `api:v1:idem:${address.toLowerCase()}:${key}`,
} as const;

export const TTL = {
  nonce: 10 * 60,
  session: 24 * 60 * 60,
  idempotency: 24 * 60 * 60,
} as const;
