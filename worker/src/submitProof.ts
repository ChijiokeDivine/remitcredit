// worker/src/submitProof.ts
import { JsonRpcProvider } from "ethers";
import { RemitCreditConfig } from "../../shared/config";
import { ProofService } from "../../shared/services/proofService";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { decodeErc20Remittance } from "../../shared/services/txDecoder";
import { SenderNotApprovedError } from "../../shared/errors";
import {
  encodeTxBytesForContract,
  encodeMerkleProofForContract,
  encodeContinuityProofForContract,
} from "../../shared/services/proofEncoding";

export interface SubmitProofResult {
  sourceTxHash: string; // the real source-chain tx hash (for display/lookup)
  onchainSourceTxHash: string; // keccak256(txBytes) — what's actually recorded on-chain
  borrower: string;
  onchainTxHash: string; // the Creditcoin (relayer) tx hash for this submission
  amount: string;
}

/// Runs the full Deploy → Prove → Verify pipeline for one remittance
/// transaction: decode it, wait for + fetch its Attestcoin proof, and
/// submit it to RemittanceMicroLoan for on-chain verification.
///
/// Note: the registry's `isTransferRecorded` / `DuplicateTransfer` dedupe key
/// is keccak256(txBytes) (see ProofService), not the source chain's real tx
/// hash — those are different values (see proofService.ts for why). That
/// value only exists once the proof has been built, so the dedupe check runs
/// *after* `buildProofForTransaction`, not before. Idempotent in effect — if
/// the transfer is already recorded, this throws AlreadyRecordedError, which
/// the caller can treat as a no-op rather than an error.
export async function submitRemittanceProofForTx(
  config: RemitCreditConfig,
  client: RemitCreditClient,
  borrower: string,
  sourceTxHash: string
): Promise<SubmitProofResult> {
  const sourceProvider = new JsonRpcProvider(config.sourceChain.rpcUrl);
  const proofService = new ProofService(config, config.worker.privateKey);

  const decoded = await decodeErc20Remittance(sourceProvider, sourceTxHash);

  const borrowerRecord = await client.getBorrower(borrower);
  if (!borrowerRecord.registered) {
    throw new Error(`Borrower ${borrower} is not registered`);
  }
  const isApprovedSender = borrowerRecord.declaredSenders.some(
    (s) => s.toLowerCase() === decoded.sender.toLowerCase()
  );
  if (!isApprovedSender) {
    throw new SenderNotApprovedError(borrower, decoded.sender, borrowerRecord.declaredSenders);
  }

  const proof = await proofService.buildProofForTransaction(sourceTxHash);

  // Dedupe on the value actually recorded on-chain (keccak256(txBytes)),
  // now that we have it — not on the real source-chain hash, which the
  // registry never stores.
  const alreadyRecorded = await client.isTransferRecorded(proof.sourceTxHash);
  if (alreadyRecorded) {
    throw new AlreadyRecordedError(proof.realTxHash);
  }

  // ── DEBUG: staticCall submitRemittanceProof itself, not just the
  // precompile. staticCall goes through eth_call, not eth_estimateGas —
  // on this RPC, eth_estimateGas has been swallowing revert data on every
  // failure so far ("data: 0x", no decodable reason). eth_call should
  // surface the actual custom error (ProofNotVerified, TxHashMismatch,
  // etc.) that's been hiding behind that empty response the whole time.
  try {
    await client.loan.submitRemittanceProof.staticCall(
      borrower,
      proof.chainKey,
      proof.blockHeight,
      encodeTxBytesForContract(proof.txBytes),
      encodeMerkleProofForContract(proof.merkleProof),
      encodeContinuityProofForContract(proof.continuityProof),
      decoded.sender,
      decoded.amount,
      decoded.sourceTimestamp,
      proof.sourceTxHash
    );
    console.log("[debug] staticCall submitRemittanceProof succeeded (no revert)");
  } catch (err) {
    console.log("[debug] staticCall submitRemittanceProof reverted:", err);
  }
  // ── END DEBUG

  const tx = await client.submitRemittanceProof(
    borrower,
    proof,
    decoded.sender,
    decoded.amount,
    decoded.sourceTimestamp
  );
  const receipt = await tx.wait();

  return {
    sourceTxHash: proof.realTxHash,
    onchainSourceTxHash: proof.sourceTxHash,
    borrower,
    onchainTxHash: receipt?.hash ?? tx.hash,
    amount: decoded.amount,
  };
}

export class AlreadyRecordedError extends Error {
  constructor(sourceTxHash: string) {
    super(`Transaction ${sourceTxHash} is already recorded in the credit registry`);
    this.name = "AlreadyRecordedError";
  }
}