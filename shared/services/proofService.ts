// shared/services/proofService.ts
//
// Thin wrapper around @gluwa/usc-sdk's proof-generation pipeline. Assembled
// from the SDK's documented usage pattern:
//   1. Resolve the source chain's chainKey (chainInfoService.ts).
//   2. Wait until the block containing the transaction is attested on
//      Creditcoin (attestation happens automatically & periodically).
//   3. Fetch the inclusion proof (Merkle + continuity) from the hosted
//      Prover API — the recommended starting point per the docs, versus
//      building proofs from raw indexed data yourself.
//   4. Hand the proof to RemittanceMicroLoan.submitRemittanceProof, which
//      verifies it on-chain via the precompile synchronously.
//
// NOTE: method names below (waitUntilHeightAttested, generateProof, etc.)
// follow the SDK's documented usage snippet as published. Pin down the
// exact method signatures against the installed @gluwa/usc-sdk version
// (`node_modules/@gluwa/usc-sdk`) once it's installed, and adjust this file
// — the rest of the codebase only depends on the RemittanceProofData shape
// this module returns, not on SDK internals.
import { JsonRpcProvider } from "ethers";
// @ts-ignore — types resolved once the package is installed (network access
// is unavailable in this sandbox, so this couldn't be installed/verified here).
import { chainInfo, blockProver, proofGenerator } from "@gluwa/usc-sdk";
import { RemitCreditConfig } from "../config";
import { RemittanceProofData } from "../types";

export class ProofService {
  private readonly sourceProvider: JsonRpcProvider;
  private readonly creditcoinProvider: JsonRpcProvider;
  private readonly chainInfoProvider: any;
  private readonly prover: any;
  private readonly proofGenApi: any;
  private readonly chainKey: number;

  constructor(config: RemitCreditConfig) {
    this.chainKey = config.sourceChain.chainKey;
    this.sourceProvider = new JsonRpcProvider(config.sourceChain.rpcUrl);
    this.creditcoinProvider = new JsonRpcProvider(config.creditcoin.rpcUrl);
    this.chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(this.creditcoinProvider);
    this.prover = new blockProver.PrecompileBlockProver(this.creditcoinProvider);
    this.proofGenApi = new proofGenerator.api.ProverAPIProofGenerator(
      this.chainKey,
      config.usc.proverApiUrl
    );
  }

  /// Confirms the source chain / chainKey pairing is currently supported.
  /// Call this once at worker/backend startup so a misconfigured chainKey
  /// fails fast instead of silently rejecting every later proof.
  async assertChainSupported(): Promise<void> {
    const supported = await this.chainInfoProvider.getSupportedChains?.();
    if (supported && Array.isArray(supported) && !supported.includes(this.chainKey)) {
      throw new Error(
        `chainKey ${this.chainKey} is not in the Attestcoin Protocol's currently supported chains: ${supported.join(", ")}`
      );
    }
  }

  /// Full pipeline for one transaction: locate its block, wait for
  /// attestation, and fetch the inclusion proof. Can take up to the
  /// configured attestation timeout (SDK default ~15 minutes) if the
  /// transaction is very recent.
  async buildProofForTransaction(sourceTxHash: string): Promise<RemittanceProofData> {
    const tx = await this.sourceProvider.getTransaction(sourceTxHash);
    if (!tx || tx.blockNumber === null) {
      throw new Error(`Transaction ${sourceTxHash} not found or not yet mined on the source chain`);
    }

    await this.proofGenApi.waitUntilHeightAttested(tx.blockNumber);

    const proofData = await this.proofGenApi.generateProof(sourceTxHash, tx.blockNumber);

    return {
      chainKey: this.chainKey,
      blockHeight: tx.blockNumber,
      txBytes: proofData.txBytes,
      merkleProof: proofData.merkleProof,
      continuityProof: proofData.continuityProof,
      sourceTxHash,
    };
  }

  /// Fetch proofs for several transactions that share a continuity proof
  /// window, for the batch-submission path (up to 10 per Attestcoin's
  /// documented batch limit).
  async buildBatchProof(sourceTxHashes: string[]): Promise<{
    chainKey: number;
    blockHeights: number[];
    txBytesArr: string[];
    merkleProofs: string[];
    continuityProof: string;
  }> {
    if (sourceTxHashes.length === 0 || sourceTxHashes.length > 10) {
      throw new Error("Batch proofs support between 1 and 10 transactions");
    }

    const batchData = await this.proofGenApi.generateBatchProof(sourceTxHashes);

    const blockHeights: number[] = [];
    const txBytesArr: string[] = [];
    const merkleProofs: string[] = [];
    for (const [headerNumber, proofsMap] of batchData.merkleProofs.entries()) {
      for (const [, proofEntry] of proofsMap.entries()) {
        blockHeights.push(headerNumber);
        txBytesArr.push(proofEntry.txBytes);
        merkleProofs.push(proofEntry.merkleProof);
      }
    }

    return {
      chainKey: this.chainKey,
      blockHeights,
      txBytesArr,
      merkleProofs,
      continuityProof: batchData.continuityProof,
    };
  }

  /// Optional off-chain sanity check before spending gas on-chain — mirrors
  /// what RemittanceMicroLoan will do anyway, useful for the backend to
  /// give a fast "this proof looks valid" response.
  async verifyOffchain(proof: RemittanceProofData): Promise<boolean> {
    return this.prover.verifySingle(
      proof.chainKey,
      proof.blockHeight,
      proof.txBytes,
      proof.merkleProof,
      proof.continuityProof
    );
  }
}
