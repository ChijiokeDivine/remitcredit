// src/server/v1/auth.ts
// SIWE-style wallet authentication. Nonces + sessions in Redis.
import { randomBytes, createHash } from "crypto";
import { verifyMessage, getAddress, isAddress } from "ethers";
import { redis, Keys, TTL } from "./redis";
import { V1Error } from "./errors";
import { getConfig } from "../config";

const SIWE_VERSION = "1";

function domainFromEnv(): string {
  return (
    process.env.API_SIWE_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.VERCEL_URL ||
    "localhost"
  )
    .replace(/^https?:\/\//, "")
    .split("/")[0];
}

function uriFromEnv(): string {
  if (process.env.API_SIWE_URI) return process.env.API_SIWE_URI;
  const domain = domainFromEnv();
  const proto = domain.startsWith("localhost") ? "http" : "https";
  return `${proto}://${domain}`;
}

function chainIdFromConfig(): number {
  try {
    return getConfig().creditcoin.chainId;
  } catch {
    return Number(process.env.CC3_TESTNET_CHAIN_ID ?? "102031");
  }
}

export type SiweChallenge = {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  message: string;
};

export function buildSiweMessage(fields: Omit<SiweChallenge, "message">): string {
  return [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    "",
    fields.statement,
    "",
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
  ].join("\n");
}

export async function createChallenge(rawAddress: string): Promise<SiweChallenge> {
  if (!isAddress(rawAddress)) {
    throw new V1Error("VALIDATION_ERROR", "Invalid wallet address.", 400);
  }
  const address = getAddress(rawAddress);
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + TTL.nonce * 1000).toISOString();
  const domain = domainFromEnv();
  const uri = uriFromEnv();
  const chainId = chainIdFromConfig();
  const statement =
    "Sign in to RemitCredit API. This proves you control this wallet and does not trigger a blockchain transaction or cost gas.";
  const fields = {
    domain,
    address,
    statement,
    uri,
    version: SIWE_VERSION,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  };
  const message = buildSiweMessage(fields);
  await redis.set(
    Keys.nonce(address, nonce),
    JSON.stringify({ address, issuedAt, expirationTime, domain, uri, chainId }),
    { ex: TTL.nonce }
  );
  return { ...fields, message };
}

export type Session = {
  token: string;
  address: string;
  issuedAt: string;
  expiresAt: string;
};

function parseSiweMessage(message: string) {
  const lines = message.split("\n");
  const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Ethereum account:$/);
  if (!domainMatch) throw new V1Error("VALIDATION_ERROR", "Malformed SIWE message (header).", 400);
  const domain = domainMatch[1];
  const addressLine = lines[1]?.trim();
  if (!addressLine || !isAddress(addressLine)) {
    throw new V1Error("VALIDATION_ERROR", "Malformed SIWE message (address).", 400);
  }
  const field = (prefix: string) => {
    const line = lines.find((l) => l.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : undefined;
  };
  const uri = field("URI:");
  const version = field("Version:");
  const chainIdStr = field("Chain ID:");
  const nonce = field("Nonce:");
  const issuedAt = field("Issued At:");
  const expirationTime = field("Expiration Time:");
  if (!uri || !version || !chainIdStr || !nonce || !issuedAt) {
    throw new V1Error("VALIDATION_ERROR", "Malformed SIWE message (missing required fields).", 400);
  }
  if (version !== SIWE_VERSION) {
    throw new V1Error("VALIDATION_ERROR", `Unsupported SIWE version: ${version}`, 400);
  }
  return {
    address: getAddress(addressLine),
    domain,
    uri,
    chainId: Number(chainIdStr),
    nonce,
    issuedAt,
    expirationTime,
  };
}

export async function verifyChallenge(message: string, signature: string): Promise<Session> {
  if (!message || !signature) {
    throw new V1Error("VALIDATION_ERROR", "message and signature are required.", 400);
  }
  const parsed = parseSiweMessage(message);
  const expectedDomain = domainFromEnv();
  const expectedUri = uriFromEnv();
  if (parsed.domain !== expectedDomain) {
    throw new V1Error("UNAUTHORIZED", "SIWE domain mismatch.", 401, {
      expected: expectedDomain,
      got: parsed.domain,
    });
  }
  if (parsed.uri !== expectedUri) {
    throw new V1Error("UNAUTHORIZED", "SIWE URI mismatch.", 401, {
      expected: expectedUri,
      got: parsed.uri,
    });
  }
  const expectedChain = chainIdFromConfig();
  if (parsed.chainId !== expectedChain) {
    throw new V1Error("UNAUTHORIZED", "SIWE chain ID mismatch.", 401, {
      expected: expectedChain,
      got: parsed.chainId,
    });
  }
  if (parsed.expirationTime) {
    const expMs = Date.parse(parsed.expirationTime);
    if (Number.isFinite(expMs) && Date.now() > expMs) {
      throw new V1Error("UNAUTHORIZED", "SIWE message has expired.", 401);
    }
  }
  const nonceKey = Keys.nonce(parsed.address, parsed.nonce);
  const stored = await redis.get<string>(nonceKey);
  if (!stored) {
    throw new V1Error("UNAUTHORIZED", "Invalid or already-used nonce. Request a new challenge.", 401);
  }
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    throw new V1Error("UNAUTHORIZED", "Invalid signature.", 401);
  }
  recovered = getAddress(recovered);
  if (recovered !== parsed.address) {
    throw new V1Error("UNAUTHORIZED", "Signature does not match the claimed address.", 401, {
      claimed: parsed.address,
      recovered,
    });
  }
  await redis.del(nonceKey);
  const token = randomBytes(32).toString("hex");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TTL.session * 1000).toISOString();
  await redis.set(
    Keys.session(token),
    JSON.stringify({ address: parsed.address, issuedAt, expiresAt }),
    { ex: TTL.session }
  );
  return { token, address: parsed.address, issuedAt, expiresAt };
}

export async function resolveSession(authorizationHeader: string | null) {
  if (!authorizationHeader) throw new V1Error("UNAUTHORIZED", "Missing Authorization header.", 401);
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    throw new V1Error("UNAUTHORIZED", "Authorization header must be: Bearer <session_token>.", 401);
  }
  const token = m[1].trim();
  if (!token || token.length < 16) throw new V1Error("UNAUTHORIZED", "Invalid session token.", 401);
  const raw = await redis.get<string>(Keys.session(token));
  if (!raw) throw new V1Error("UNAUTHORIZED", "Session expired or not found. Sign in again.", 401);
  let payload: { address: string; expiresAt: string };
  try {
    payload = typeof raw === "string" ? JSON.parse(raw) : (raw as typeof payload);
  } catch {
    throw new V1Error("UNAUTHORIZED", "Corrupt session. Sign in again.", 401);
  }
  if (payload.expiresAt && Date.parse(payload.expiresAt) < Date.now()) {
    await redis.del(Keys.session(token));
    throw new V1Error("UNAUTHORIZED", "Session expired. Sign in again.", 401);
  }
  return { address: getAddress(payload.address), token };
}

export async function revokeSession(token: string): Promise<void> {
  await redis.del(Keys.session(token));
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}
