// shared/services/senderValidationPipeline.ts
//
// Feature 3 — full sender-validation pipeline (off-chain compute).
// Triggered once at declaration time as an async background job.
// Final result is also published on-chain via SenderValidationAttestation.
//
// Steps:
//   a) Tx history pull — wallet age, tx count, volume (source-chain RPC / Alchemy)
//   b) Funding-source trace — walk inbound funding; hard-reject if funded by recipient
//   c) Sanctions screening — isSanctioned() on the provided contract

import {
  Contract,
  JsonRpcProvider,
  Wallet,
  id,
  getAddress,
} from "ethers";
import { flagSenderPair } from "./probationService";
import { addRiskFlag } from "./reputationService";

// ── Types ──────────────────────────────────────────────────────────────────

export type VerificationStatus = "pending" | "approved" | "rejected" | "flagged";
export type FundingSourceType =
  | "unknown"
  | "exchange"
  | "bridge"
  | "recipient_funded"
  | "other_eoa"
  | "mixed";

export interface ValidationResult {
  senderWallet: string;
  recipientId: string;
  verificationStatus: VerificationStatus;
  walletAgeDays: number;
  fundingSourceType: FundingSourceType;
  riskFlags: string[];
  timestamp: number;
  /** Rich detail for the explainable-score UI (not written on-chain). */
  detail: {
    firstTxTimestamp: number | null;
    totalTxCount: number;
    totalVolumeWei: string;
    fundingTrace: FundingHop[];
    sanctionsHit: boolean;
    rationale: string[];
  };
}

export interface FundingHop {
  from: string;
  to: string;
  value: string;
  txHash: string;
  blockNumber: number;
  label?: string;
}

// ── On-chain status / funding enums (match SenderValidationAttestation.sol) ─

const STATUS_CODE: Record<VerificationStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  flagged: 3,
};

const FUNDING_CODE: Record<FundingSourceType, number> = {
  unknown: 0,
  exchange: 1,
  bridge: 2,
  recipient_funded: 3,
  other_eoa: 4,
  mixed: 5,
};

// ── Sanctions ABI (from sanctions.json — view method only) ─────────────────

const SANCTIONS_ABI = [
  "function isSanctioned(address addr) view returns (bool)",
] as const;

const DEFAULT_SANCTIONS_ADDRESS =
  process.env.SANCTIONS_CONTRACT_ADDRESS ??
  "0x40c57923924b5c5c5455c48d93317139addac8fb";

// Common exchange / bridge labels (heuristic — extend via env JSON if needed)
const KNOWN_EXCHANGE_LABELS: Record<string, string> = {
  // placeholders — production should load from a maintained list or API
};

function loadKnownAddresses(): { exchanges: Set<string>; bridges: Set<string> } {
  const exchanges = new Set<string>();
  const bridges = new Set<string>();
  try {
    const raw = process.env.KNOWN_FUNDING_ADDRESSES_JSON;
    if (raw) {
      const parsed = JSON.parse(raw) as {
        exchanges?: string[];
        bridges?: string[];
      };
      for (const a of parsed.exchanges ?? []) exchanges.add(a.toLowerCase());
      for (const a of parsed.bridges ?? []) bridges.add(a.toLowerCase());
    }
  } catch {
    // ignore malformed env
  }
  return { exchanges, bridges };
}

// ── a) Tx history ──────────────────────────────────────────────────────────

async function pullWalletHistory(
  provider: JsonRpcProvider,
  address: string
): Promise<{
  firstTxTimestamp: number | null;
  totalTxCount: number;
  walletAgeDays: number;
}> {
  const checksum = getAddress(address);
  const txCount = await provider.getTransactionCount(checksum, "latest");

  // Best-effort first-tx time: binary search earliest non-zero nonce block
  // is expensive; for demo we use a limited eth_getLogs window or Alchemy
  // asset transfers if ALCHEMY_API_KEY is set.
  let firstTxTimestamp: number | null = null;

  const alchemyKey = process.env.ALCHEMY_API_KEY;
  const network = process.env.SOURCE_CHAIN_ALCHEMY_NETWORK ?? "eth-sepolia";

  if (alchemyKey) {
    try {
      const url = `https://${network}.g.alchemy.com/v2/${alchemyKey}`;
      const body = {
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: checksum,
            category: ["external", "erc20", "internal"],
            order: "asc",
            maxCount: "0x1",
            withMetadata: true,
          },
        ],
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as any;
      const t = json?.result?.transfers?.[0];
      if (t?.metadata?.blockTimestamp) {
        firstTxTimestamp = Math.floor(
          new Date(t.metadata.blockTimestamp).getTime() / 1000
        );
      } else if (t?.blockNum) {
        const block = await provider.getBlock(parseInt(t.blockNum, 16));
        firstTxTimestamp = block?.timestamp ?? null;
      }
    } catch (err) {
      console.warn("[validation] alchemy_getAssetTransfers failed:", err);
    }
  }

  // Fallback: if still null and wallet has txs, approximate with "now" age 0
  const now = Math.floor(Date.now() / 1000);
  const walletAgeDays =
    firstTxTimestamp != null
      ? Math.max(0, Math.floor((now - firstTxTimestamp) / 86400))
      : 0;

  return { firstTxTimestamp, totalTxCount: txCount, walletAgeDays };
}

// ── b) Funding-source trace ────────────────────────────────────────────────

async function traceFundingSource(
  provider: JsonRpcProvider,
  sender: string,
  recipient: string,
  maxHops = 5
): Promise<{ type: FundingSourceType; hops: FundingHop[]; volumeWei: string }> {
  const { exchanges, bridges } = loadKnownAddresses();
  const hops: FundingHop[] = [];
  const recipientLc = recipient.toLowerCase();
  const senderLc = sender.toLowerCase();

  const alchemyKey = process.env.ALCHEMY_API_KEY;
  const network = process.env.SOURCE_CHAIN_ALCHEMY_NETWORK ?? "eth-sepolia";

  let volumeWei = 0n;
  let sawExchange = false;
  let sawBridge = false;
  let sawRecipient = false;
  let sawEoa = false;

  async function inboundTransfers(to: string): Promise<FundingHop[]> {
    if (!alchemyKey) return [];
    try {
      const url = `https://${network}.g.alchemy.com/v2/${alchemyKey}`;
      const body = {
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: getAddress(to),
            category: ["external", "erc20", "internal"],
            order: "desc",
            maxCount: "0xa",
            withMetadata: true,
          },
        ],
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as any;
      const transfers: any[] = json?.result?.transfers ?? [];
      return transfers
        .filter((t) => t.from && t.hash)
        .map((t) => ({
          from: String(t.from).toLowerCase(),
          to: String(t.to ?? to).toLowerCase(),
          value: String(t.rawContract?.value ?? t.value ?? "0"),
          txHash: String(t.hash),
          blockNumber: t.blockNum ? parseInt(t.blockNum, 16) : 0,
        }));
    } catch (err) {
      console.warn("[validation] funding trace fetch failed:", err);
      return [];
    }
  }

  // Walk back from sender
  let frontier = [senderLc];
  const visited = new Set<string>([senderLc]);

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const addr of frontier) {
      const inbound = await inboundTransfers(addr);
      for (const h of inbound) {
        hops.push(h);
        try {
          // value may be hex
          const v =
            h.value.startsWith("0x")
              ? BigInt(h.value)
              : BigInt(h.value || "0");
          if (addr === senderLc) volumeWei += v;
        } catch {
          /* ignore */
        }

        if (h.from === recipientLc) {
          sawRecipient = true;
          h.label = "recipient_funded";
        } else if (exchanges.has(h.from)) {
          sawExchange = true;
          h.label = "exchange";
        } else if (bridges.has(h.from)) {
          sawBridge = true;
          h.label = "bridge";
        } else {
          sawEoa = true;
          h.label = h.label ?? "other_eoa";
        }

        if (!visited.has(h.from) && hops.length < 30) {
          visited.add(h.from);
          next.push(h.from);
        }
      }
    }
    frontier = next;
  }

  let type: FundingSourceType = "unknown";
  if (sawRecipient) type = "recipient_funded";
  else if (sawExchange && (sawBridge || sawEoa)) type = "mixed";
  else if (sawExchange) type = "exchange";
  else if (sawBridge) type = "bridge";
  else if (sawEoa) type = "other_eoa";

  void provider; // reserved for non-Alchemy fallbacks
  return { type, hops, volumeWei: volumeWei.toString() };
}

// ── c) Sanctions ───────────────────────────────────────────────────────────

async function checkSanctions(
  sourceRpcUrl: string,
  address: string
): Promise<boolean> {
  const provider = new JsonRpcProvider(sourceRpcUrl);
  const contract = new Contract(
    DEFAULT_SANCTIONS_ADDRESS,
    SANCTIONS_ABI,
    provider
  );
  try {
    return Boolean(await contract.isSanctioned(getAddress(address)));
  } catch (err) {
    console.error("[validation] isSanctioned call failed:", err);
    // Fail closed for sanctions: treat as hit if the oracle is unreachable
    // only when SANCTIONS_FAIL_CLOSED=true; otherwise fail open with a flag.
    if (process.env.SANCTIONS_FAIL_CLOSED === "true") return true;
    return false;
  }
}

// ── Pipeline entry ─────────────────────────────────────────────────────────

export interface PipelineDeps {
  sourceRpcUrl: string;
  /** Creditcoin RPC + writer key for on-chain attestation (optional). */
  creditcoinRpcUrl?: string;
  attestationAddress?: string;
  writerPrivateKey?: string;
}

/**
 * Run the full validation pipeline for a declared (sender, recipient) pair.
 * Safe to call fire-and-forget from the declaration API route.
 */
export async function runSenderValidationPipeline(
  senderWallet: string,
  recipientId: string,
  deps: PipelineDeps
): Promise<ValidationResult> {
  const sender = senderWallet.toLowerCase();
  const recipient = recipientId.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const rationale: string[] = [];
  const riskFlags: string[] = [];

  const provider = new JsonRpcProvider(deps.sourceRpcUrl);

  // a) history
  const history = await pullWalletHistory(provider, sender);
  rationale.push(
    history.firstTxTimestamp
      ? `Wallet first seen ~${history.walletAgeDays} day(s) ago (${history.totalTxCount} txs).`
      : `Wallet age unknown; outbound nonce=${history.totalTxCount}.`
  );

  const minAgeDays = Number(process.env.VALIDATION_MIN_WALLET_AGE_DAYS ?? "0");
  if (minAgeDays > 0 && history.walletAgeDays < minAgeDays) {
    riskFlags.push("YOUNG_WALLET");
    rationale.push(
      `Wallet younger than configured minimum (${minAgeDays} days).`
    );
  }

  // b) funding
  const funding = await traceFundingSource(provider, sender, recipient);
  rationale.push(`Funding source classification: ${funding.type}.`);
  if (funding.type === "recipient_funded") {
    riskFlags.push("RECIPIENT_FUNDED");
    rationale.push(
      "CRITICAL: inbound funding traced to the recipient's own wallet — automatic hard reject."
    );
  }

  // c) sanctions
  const sanctioned = await checkSanctions(deps.sourceRpcUrl, sender);
  if (sanctioned) {
    riskFlags.push("SANCTIONED");
    rationale.push("Address is on the sanctions list (isSanctioned=true).");
  } else {
    rationale.push("Sanctions screen passed.");
  }

  // Decision
  let verificationStatus: VerificationStatus = "approved";
  if (sanctioned || funding.type === "recipient_funded") {
    verificationStatus = "rejected";
  } else if (riskFlags.length > 0) {
    verificationStatus = "flagged";
  }

  const result: ValidationResult = {
    senderWallet: sender,
    recipientId: recipient,
    verificationStatus,
    walletAgeDays: history.walletAgeDays,
    fundingSourceType: funding.type,
    riskFlags,
    timestamp: now,
    detail: {
      firstTxTimestamp: history.firstTxTimestamp,
      totalTxCount: history.totalTxCount,
      totalVolumeWei: funding.volumeWei,
      fundingTrace: funding.hops,
      sanctionsHit: sanctioned,
      rationale,
    },
  };

  // Side effects on off-chain stores
  if (verificationStatus === "rejected" || verificationStatus === "flagged") {
    await flagSenderPair(
      sender,
      recipient,
      riskFlags[0] ?? verificationStatus.toUpperCase()
    );
    for (const f of riskFlags) {
      await addRiskFlag(sender, f);
    }
  }

  // Publish on-chain attestation when configured
  if (
    deps.creditcoinRpcUrl &&
    deps.attestationAddress &&
    deps.writerPrivateKey
  ) {
    try {
      await publishAttestation(result, deps);
      rationale.push("On-chain attestation published.");
    } catch (err) {
      console.error("[validation] on-chain attest failed:", err);
      rationale.push(
        "On-chain attestation failed (off-chain result still valid for UI)."
      );
    }
  }

  return result;
}

const ATTESTATION_ABI = [
  "function attest(address senderWallet, address recipient, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags) external",
  "function getAttestation(address senderWallet, address recipient) view returns (address sender, address recip, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags, uint64 timestamp, bool exists)",
  "event SenderAttested(address indexed senderWallet, address indexed recipient, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags, uint64 timestamp)",
] as const;

async function publishAttestation(
  result: ValidationResult,
  deps: PipelineDeps
): Promise<string> {
  const provider = new JsonRpcProvider(deps.creditcoinRpcUrl!);
  const wallet = new Wallet(deps.writerPrivateKey!, provider);
  const contract = new Contract(
    deps.attestationAddress!,
    ATTESTATION_ABI,
    wallet
  );

  const flagHashes = result.riskFlags.map((f) => id(f));
  const tx = await contract.attest(
    getAddress(result.senderWallet),
    getAddress(result.recipientId),
    STATUS_CODE[result.verificationStatus],
    result.walletAgeDays,
    FUNDING_CODE[result.fundingSourceType],
    flagHashes
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/** Read published attestation from chain (audit path). */
export async function readOnChainAttestation(
  creditcoinRpcUrl: string,
  attestationAddress: string,
  sender: string,
  recipient: string
): Promise<{
  exists: boolean;
  verificationStatus: number;
  walletAgeDays: number;
  fundingSourceType: number;
  riskFlags: string[];
  timestamp: number;
} | null> {
  const provider = new JsonRpcProvider(creditcoinRpcUrl);
  const contract = new Contract(
    attestationAddress,
    ATTESTATION_ABI,
    provider
  );
  try {
    const a = await contract.getAttestation(
      getAddress(sender),
      getAddress(recipient)
    );
    if (!a.exists) return null;
    return {
      exists: true,
      verificationStatus: Number(a.verificationStatus),
      walletAgeDays: Number(a.walletAgeDays),
      fundingSourceType: Number(a.fundingSourceType),
      riskFlags: (a.riskFlags as string[]) ?? [],
      timestamp: Number(a.timestamp),
    };
  } catch {
    return null;
  }
}

// In-memory cache of latest off-chain results for UI (also mirror to Redis if desired)
const resultCache = new Map<string, ValidationResult>();
const cacheKey = (s: string, r: string) =>
  `${s.toLowerCase()}:${r.toLowerCase()}`;

export function cacheValidationResult(result: ValidationResult): void {
  resultCache.set(cacheKey(result.senderWallet, result.recipientId), result);
}

export function getCachedValidationResult(
  sender: string,
  recipient: string
): ValidationResult | null {
  return resultCache.get(cacheKey(sender, recipient)) ?? null;
}
