// shared/services/proofService.ts
//
// Wrapper around @gluwa/usc-sdk (^0.18) proof pipeline.
// Current SDK surface (see gluwa/cc-next-query-builder examples):
//   import { chainInfo, blockProver, proofProvider } from "@gluwa/usc-sdk"
//   new proofProvider.service.ProofBuilder(chainKey, proverApiUrl)
//   chainInfoProvider.waitUntilHeightAttested(chainKey, height)
//   proofBuilder.getProof(txHash) → { success, data | error }
//
// IMPORTANT — sourceTxHash vs. on-chain hash:
// The SDK's `proofData.txBytes` is documented as an ABI-encoded transaction,
// not the raw RLP-serialized transaction. That means it will never satisfy
// RemittanceMicroLoan's on-chain check:
//   if (sourceTxHash != keccak256(encodedTx)) revert TxHashMismatch();
// because keccak256(rawSerializedTx) (the real source-chain tx hash) and
// keccak256(ABI-encoded txBytes) are hashes of two different byte strings.
// Since `encodedTx` is fixed (it must be proofData.txBytes — that's what the
// Merkle proof was built over), we instead derive the value we submit as
// `sourceTxHash` from txBytes itself, client-side, so the contract's
// tautological check always holds. The real source-chain tx hash (passed in
// as the `sourceTxHash` parameter here) is preserved on the returned object
// as `realTxHash` for display/lookup purposes — it is NOT what gets sent to
// the contract.
//
// DEBUG — verifyAndEmitDirect():
// verifyOffchain() below calls the SDK wrapper's `verifySingle`, which maps
// to the precompile's *read-only* `verify()` — no event, no state change,
// and per IAttestcoinBlockProver.sol's own doc comment, no described
// revert-on-failure behavior beyond the read. RemittanceMicroLoan instead
// calls the state-changing `verifyAndEmit()`, which explicitly *does*
// revert on failed verification. A proof that passes `verify()` is not
// guaranteed to pass `verifyAndEmit()` — they are different entry points
// into the precompile, not the same check with different plumbing.
// verifyAndEmitDirect() calls `verifyAndEmit` directly against the
// precompile address, using the exact same ABI shape RemittanceMicroLoan
// uses, but without going through the contract at all. This isolates
// whether a rejection is precompile/proof-side (fails here too) or specific
// to the RemittanceMicroLoan call site (succeeds here, still fails there).

import { JsonRpcProvider, Wallet, Contract, keccak256 } from "ethers";
import { chainInfo, blockProver, proofProvider } from "@gluwa/usc-sdk";
import { RemitCreditConfig } from "../config";
import { RemittanceProofData } from "../types";
import { AttestationPendingError } from "../errors";

// Poll cadence for attestation checks — matches the SDK's own default so
// logs stay familiar.
const ATTESTATION_POLL_MS = 5_000;
// Give up well before Next's route `maxDuration = 120` kills the request
// outright (which would produce an opaque platform timeout instead of our
// own clean, actionable error).
const ATTESTATION_WAIT_BUDGET_MS = 90_000;
// If we never observe the attested height move at all, we have no basis
// for a rate-based estimate — fall back to a fixed, conservative suggestion.
const FALLBACK_RETRY_SECONDS = 5 * 60;

// Minimal single-transaction ABI for the BlockProver precompile, matching
// IAttestcoinBlockProver.sol's `verify`/`verifyAndEmit` (non-batch) exactly.
// Built independently of the @gluwa/usc-sdk wrapper so this is a true
// apples-to-apples comparison against what RemittanceMicroLoan calls.
const BLOCK_PROVER_SINGLE_ABI = [
  "function verify(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) view returns (bool verified)",
  "function verifyAndEmit(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (bool verified)",
  "event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex)",
];

export class ProofService {
  private readonly sourceProvider: JsonRpcProvider;
  private readonly creditcoinProvider: JsonRpcProvider;
  private readonly chainInfoProvider: InstanceType<
    typeof chainInfo.PrecompileChainInfoProvider
  >;
  private readonly prover: InstanceType<typeof blockProver.PrecompileBlockProver>;
  private readonly proofBuilder: InstanceType<
    typeof proofProvider.service.ProofBuilder
  >;
  private readonly chainKey: number;

  // Only set when a privateKey is passed in — needed to send the
  // state-changing verifyAndEmit debug call below.
  private readonly signer?: Wallet;
  private readonly proverRaw: Contract;

  constructor(config: RemitCreditConfig, privateKey?: string) {
    this.chainKey = config.sourceChain.chainKey;
    this.sourceProvider = new JsonRpcProvider(config.sourceChain.rpcUrl);
    this.creditcoinProvider = new JsonRpcProvider(config.creditcoin.rpcUrl);
    this.signer = privateKey ? new Wallet(privateKey, this.creditcoinProvider) : undefined;

    this.chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(
      this.creditcoinProvider
    );
    this.prover = new blockProver.PrecompileBlockProver(this.creditcoinProvider);
    // SDK 0.18+: ProofBuilder lives under proofProvider.service (not proofGenerator.api)
    this.proofBuilder = new proofProvider.service.ProofBuilder(
      this.chainKey,
      config.usc.proverApiUrl
    );

    // Raw, SDK-independent handle on the precompile for verifyAndEmitDirect().
    this.proverRaw = new Contract(
      config.usc.precompileAddress,
      BLOCK_PROVER_SINGLE_ABI,
      this.signer ?? this.creditcoinProvider
    );
  }

  /**
   * Polls Creditcoin's attested height for `chainKey` until it reaches
   * `targetHeight`, or gives up after ATTESTATION_WAIT_BUDGET_MS and throws
   * AttestationPendingError with a retry estimate derived from the
   * attestation rate actually observed during this call (heights/sec since
   * the first poll) — not a guess. Falls back to a fixed suggestion if the
   * height never moved during the budget (rate is 0 or unknown).
   */
  private async waitForAttestationWithEstimate(
    chainKey: number,
    targetHeight: number
  ): Promise<void> {
    const startedAt = Date.now();
    let firstSeenHeight: number | null = null;
    let firstSeenAt = startedAt;
    let latestHeight = 0;

    while (Date.now() - startedAt < ATTESTATION_WAIT_BUDGET_MS) {
      const attested = await this.chainInfoProvider.getLatestAttestedHeightAndHash(chainKey);
      latestHeight = Number(attested.height);

      if (latestHeight >= targetHeight) return;

      if (firstSeenHeight === null) {
        firstSeenHeight = latestHeight;
        firstSeenAt = Date.now();
      }

      console.log(
        `Height ${targetHeight} not yet attested on chain key ${chainKey}. ` +
          `Latest attested height is ${latestHeight}. Retrying in ${ATTESTATION_POLL_MS}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, ATTESTATION_POLL_MS));
    }

    // Timed out within our budget — estimate a sensible retry-after from
    // observed progress, if any.
    const elapsedSeconds = (Date.now() - firstSeenAt) / 1000;
    const heightsGained = latestHeight - (firstSeenHeight ?? latestHeight);
    const heightsRemaining = targetHeight - latestHeight;

    let retryAfterSeconds = FALLBACK_RETRY_SECONDS;
    if (heightsGained > 0 && elapsedSeconds > 0) {
      const heightsPerSecond = heightsGained / elapsedSeconds;
      const estimate = heightsRemaining / heightsPerSecond;
      // 30% buffer since attestation rate can be uneven; clamp to something
      // sane so a brief stall doesn't produce an absurd multi-hour estimate.
      retryAfterSeconds = Math.min(Math.max(Math.ceil(estimate * 1.3), 30), 30 * 60);
    }

    throw new AttestationPendingError(chainKey, targetHeight, latestHeight, retryAfterSeconds);
  }

  async assertChainSupported(): Promise<void> {
    const supported = await this.chainInfoProvider.getSupportedChains();
    if (!supported || !Array.isArray(supported)) return;

    const keys = supported.map((e: { chainKey?: number } | number) =>
      typeof e === "number" ? e : e.chainKey
    );
    if (!keys.includes(this.chainKey)) {
      throw new Error(
        `chainKey ${this.chainKey} is not in Attestcoin supported chains: ${keys.join(", ")}`
      );
    }
  }

  /**
   * Full pipeline: resolve source tx → wait for Creditcoin attestation → fetch proof.
   * Attestation can take several minutes for a very recent tx (SDK default timeout ~15m).
   *
   * The `sourceTxHash` on the returned RemittanceProofData is
   * keccak256(proofData.txBytes) — the value RemittanceMicroLoan's
   * TxHashMismatch check actually requires — NOT the real source-chain
   * transaction hash. The real hash (what you passed in as `sourceTxHash`
   * here, and what a block explorer understands) is returned separately as
   * `realTxHash`. Use `realTxHash` for display/explorer links and
   * `sourceTxHash` for anything that talks to the contract (submitting the
   * proof, checking `isTransferRecorded`, reading `VerifiedTransferRecorded`
   * events).
   */
  async buildProofForTransaction(sourceTxHash: string): Promise<RemittanceProofData> {
    const tx = await this.sourceProvider.getTransaction(sourceTxHash);
    if (!tx || tx.blockNumber == null) {
      throw new Error(
        `Transaction ${sourceTxHash} not found or not yet mined on the source chain`
      );
    }

    await this.waitForAttestationWithEstimate(this.chainKey, tx.blockNumber);

    const proofResult = await this.proofBuilder.getProof(sourceTxHash);
    if (!proofResult?.success || !proofResult.data) {
      throw new Error(
        `Proof generation failed: ${proofResult?.error ?? "unknown error"}`
      );
    }

    const proofData = proofResult.data;

    // This is the identifier the contract's TxHashMismatch check requires —
    // derived from the exact bytes we're about to submit as `encodedTx`,
    // not from the source chain's own transaction hash.
    const onchainTxHash = keccak256(proofData.txBytes as any);

    return {
      chainKey: proofData.chainKey ?? this.chainKey,
      blockHeight: proofData.headerNumber ?? tx.blockNumber,
      txBytes: proofData.txBytes,
      merkleProof: proofData.merkleProof,
      continuityProof: proofData.continuityProof,
      sourceTxHash: onchainTxHash,
      realTxHash: sourceTxHash,
    };
  }

  async buildBatchProof(sourceTxHashes: string[]): Promise<{
    chainKey: number;
    blockHeights: number[];
    txBytesArr: Array<string | Uint8Array>;
    merkleProofs: unknown[];
    continuityProof: unknown;
    onchainTxHashes: string[];
    realTxHashes: string[];
  }> {
    if (sourceTxHashes.length === 0 || sourceTxHashes.length > 10) {
      throw new Error("Batch proofs support between 1 and 10 transactions");
    }

    const builder = this.proofBuilder as {
      getBatchProof?: (hashes: string[]) => Promise<{
        success: boolean;
        error?: string;
        data?: {
          continuityProof: unknown;
          proofs?: Array<{
            headerNumber: number;
            txBytes: string | Uint8Array;
            merkleProof: unknown;
          }>;
        };
      }>;
      getProof: (hash: string) => Promise<{
        success: boolean;
        error?: string;
        data?: {
          headerNumber: number;
          txBytes: string | Uint8Array;
          merkleProof: unknown;
          continuityProof: unknown;
        };
      }>;
    };

    if (typeof builder.getBatchProof === "function") {
      const batch = await builder.getBatchProof(sourceTxHashes);
      if (!batch?.success || !batch.data) {
        throw new Error(`Batch proof failed: ${batch?.error ?? "unknown"}`);
      }
      const blockHeights: number[] = [];
      const txBytesArr: Array<string | Uint8Array> = [];
      const merkleProofs: unknown[] = [];
      const onchainTxHashes: string[] = [];
      const proofs = batch.data.proofs ?? [];
      for (let i = 0; i < proofs.length; i++) {
        const p = proofs[i];
        blockHeights.push(p.headerNumber);
        txBytesArr.push(p.txBytes);
        merkleProofs.push(p.merkleProof);
        onchainTxHashes.push(keccak256(p.txBytes as any));
      }
      return {
        chainKey: this.chainKey,
        blockHeights,
        txBytesArr,
        merkleProofs,
        continuityProof: batch.data.continuityProof,
        onchainTxHashes,
        realTxHashes: sourceTxHashes.slice(0, proofs.length),
      };
    }

    const blockHeights: number[] = [];
    const txBytesArr: Array<string | Uint8Array> = [];
    const merkleProofs: unknown[] = [];
    const onchainTxHashes: string[] = [];
    const realTxHashes: string[] = [];
    let continuityProof: unknown = null;

    for (const hash of sourceTxHashes) {
      const single = await this.buildProofForTransaction(hash);
      blockHeights.push(single.blockHeight);
      txBytesArr.push(single.txBytes);
      merkleProofs.push(single.merkleProof);
      onchainTxHashes.push(single.sourceTxHash);
      realTxHashes.push(single.realTxHash);
      continuityProof = single.continuityProof;
    }

    return {
      chainKey: this.chainKey,
      blockHeights,
      txBytesArr,
      merkleProofs,
      continuityProof,
      onchainTxHashes,
      realTxHashes,
    };
  }

  /** Read-only precompile check via the SDK wrapper (`verify`, not `verifyAndEmit`). */
  async verifyOffchain(proof: RemittanceProofData): Promise<boolean> {
    return this.prover.verifySingle(
      proof.chainKey,
      proof.blockHeight,
      proof.txBytes as never,
      proof.merkleProof as never,
      proof.continuityProof as never
    );
  }

  /**
   * DEBUG: calls the precompile's state-changing `verifyAndEmit` directly —
   * same call RemittanceMicroLoan makes internally — but with nothing else
   * in between. Requires a privateKey to have been passed to the
   * constructor (needs a signer to send a transaction, not just read).
   *
   * If this reverts the same way the full flow does: the rejection is
   * precompile/proof-side (staleness, expiry, re-verification rules —
   * something `verify()` doesn't check but `verifyAndEmit()` does), not a
   * RemittanceMicroLoan bug.
   * If this succeeds: the bug is specific to how RemittanceMicroLoan calls
   * verifyAndEmit (or what it does immediately before/after that call).
   */
  async verifyAndEmitDirect(
    proof: RemittanceProofData
  ): Promise<{ verified: boolean; txHash: string }> {
    if (!this.signer) {
      throw new Error(
        "ProofService was constructed without a privateKey — pass one to test verifyAndEmit directly"
      );
    }

    const tx = await this.proverRaw.verifyAndEmit(
      proof.chainKey,
      proof.blockHeight,
      proof.txBytes,
      proof.merkleProof,
      proof.continuityProof
    );
    const receipt = await tx.wait();

    return {
      verified: receipt?.status === 1,
      txHash: receipt?.hash ?? tx.hash,
    };
  }
}