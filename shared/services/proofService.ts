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

import { JsonRpcProvider, keccak256 } from "ethers";
import { chainInfo, blockProver, proofProvider } from "@gluwa/usc-sdk";
import { RemitCreditConfig } from "../config";
import { RemittanceProofData } from "../types";

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

  constructor(config: RemitCreditConfig) {
    this.chainKey = config.sourceChain.chainKey;
    this.sourceProvider = new JsonRpcProvider(config.sourceChain.rpcUrl);
    this.creditcoinProvider = new JsonRpcProvider(config.creditcoin.rpcUrl);

    this.chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(
      this.creditcoinProvider
    );
    this.prover = new blockProver.PrecompileBlockProver(this.creditcoinProvider);
    // SDK 0.18+: ProofBuilder lives under proofProvider.service (not proofGenerator.api)
    this.proofBuilder = new proofProvider.service.ProofBuilder(
      this.chainKey,
      config.usc.proverApiUrl
    );
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

    await this.chainInfoProvider.waitUntilHeightAttested(
      this.chainKey,
      tx.blockNumber
    );

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

  async verifyOffchain(proof: RemittanceProofData): Promise<boolean> {
    return this.prover.verifySingle(
      proof.chainKey,
      proof.blockHeight,
      proof.txBytes as never,
      proof.merkleProof as never,
      proof.continuityProof as never
    );
  }
}