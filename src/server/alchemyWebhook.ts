// server/alchemyWebhook.ts
//
// Helpers for Alchemy Custom / Address Activity webhooks:
//   - HMAC-SHA256 signature verification (X-Alchemy-Signature)
//   - Parse ERC-20 Transfer logs from a Custom Webhook GraphQL payload
//
// Alchemy signs the *raw* request body with the per-webhook signing key.
// Always verify against the raw string, never a re-serialized JSON object.

import { createHmac, timingSafeEqual } from "crypto";

/** Standard ERC-20 Transfer(address,address,uint256) topic0 */
export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface ParsedTransfer {
  from: string; // checksum-agnostic lowercase 0x…
  to: string;
  txHash: string;
  logIndex: number;
  /** raw amount as hex data (optional — decode only if needed) */
  data?: string;
}

/**
 * Verify the X-Alchemy-Signature header.
 * Returns true only when the signature matches the raw body.
 */
export function verifyAlchemySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  signingKey: string | undefined = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY
): boolean {
  if (!signingKey || !signatureHeader) return false;

  const digest = createHmac("sha256", signingKey)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** topics[1] / topics[2] are 32-byte left-padded addresses */
export function topicToAddress(topic: string): string {
  if (!topic || topic.length < 66) {
    throw new Error(`Invalid topic for address extraction: ${topic}`);
  }
  return ("0x" + topic.slice(26)).toLowerCase();
}

/**
 * Extract ERC-20 Transfer events from an Alchemy Custom Webhook payload.
 *
 * Expected shape (Custom / GRAPHQL webhook):
 *   payload.event.data.block.logs[]  with topics, data, transaction.hash, …
 *
 * Also tolerates a flat Address Activity style if you switch webhook types later.
 */
export function parseTransfersFromAlchemyPayload(payload: unknown): ParsedTransfer[] {
  const out: ParsedTransfer[] = [];

  const root = payload as any;

  // ── Custom Webhook (GraphQL) ──────────────────────────────────────────
  const logs: any[] = root?.event?.data?.block?.logs ?? [];
  for (const log of logs) {
    const topics: string[] = log?.topics ?? [];
    if (!topics[0] || topics[0].toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    if (topics.length < 3) continue;

    const txHash: string | undefined = log?.transaction?.hash;
    if (!txHash) continue;

    try {
      out.push({
        from: topicToAddress(topics[1]),
        to: topicToAddress(topics[2]),
        txHash,
        logIndex: typeof log.index === "number" ? log.index : 0,
        data: typeof log.data === "string" ? log.data : undefined,
      });
    } catch {
      // skip malformed log
    }
  }

  // ── Address Activity fallback (optional) ──────────────────────────────
  // activity[].category === "token", hash, fromAddress, toAddress, rawContract
  const activity: any[] = root?.event?.activity ?? [];
  for (const item of activity) {
    if (item?.category !== "token") continue;
    const txHash: string | undefined = item?.hash;
    const from: string | undefined = item?.fromAddress;
    const to: string | undefined = item?.toAddress;
    if (!txHash || !from || !to) continue;

    out.push({
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      txHash,
      logIndex: 0,
    });
  }

  return out;
}
