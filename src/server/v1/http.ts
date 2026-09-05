// src/server/v1/http.ts
import { randomBytes } from "crypto";
import { redis, Keys, TTL } from "./redis";
import { resolveSession } from "./auth";
import { V1Error, v1ErrorResponse, v1Json } from "./errors";

export function requestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${randomBytes(8).toString("hex")}`
  );
}

export async function requireAuth(req: Request) {
  return resolveSession(req.headers.get("authorization"));
}

export function assertSelf(authAddress: string, resourceAddress: string) {
  if (authAddress.toLowerCase() !== resourceAddress.toLowerCase()) {
    throw new V1Error("FORBIDDEN", "Authenticated wallet is not authorized for this resource.", 403, {
      authenticated: authAddress,
      resource: resourceAddress,
    });
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  }
}

export async function withIdempotency(
  req: Request,
  address: string,
  rid: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key) return handler();
  if (key.length > 128) {
    throw new V1Error("VALIDATION_ERROR", "Idempotency-Key must be ≤ 128 characters.", 400);
  }
  const redisKey = Keys.idempotency(address, key);
  const existing = await redis.get<string>(redisKey);
  if (existing) {
    try {
      const cached =
        typeof existing === "string"
          ? JSON.parse(existing)
          : (existing as { status: number; body: unknown });
      return v1Json(cached.body, cached.status, rid, { "X-Idempotency-Replayed": "true" });
    } catch {
      /* recompute */
    }
  }
  const lockOk = await redis.set(redisKey + ":lock", "1", { nx: true, ex: 120 });
  if (lockOk === null) {
    throw new V1Error(
      "IDEMPOTENCY_CONFLICT",
      "A request with this Idempotency-Key is already in progress. Retry shortly.",
      409,
      undefined,
      true
    );
  }
  try {
    const res = await handler();
    if (res.status >= 200 && res.status < 500) {
      const bodyText = await res.clone().text();
      let body: unknown = bodyText;
      try {
        body = JSON.parse(bodyText);
      } catch {
        /* keep text */
      }
      await redis.set(redisKey, JSON.stringify({ status: res.status, body }), { ex: TTL.idempotency });
    }
    return res;
  } finally {
    await redis.del(redisKey + ":lock");
  }
}

export function v1Handler(
  fn: (ctx: { req: Request; rid: string }) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const rid = requestId(req);
    try {
      return await fn({ req, rid });
    } catch (err) {
      return v1ErrorResponse(err, rid);
    }
  };
}
