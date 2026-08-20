// worker/src/submitProof.ts
import { JsonRpcProvider } from "ethers";
import { RemitCreditConfig } from "../../shared/config";
import { ProofService } from "../../shared/services/proofService";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { decodeErc20Remittance } from "../../shared/services/txDecoder";

export interface SubmitProofResult {
  sourceTxHash: string;
  borrower: string;
  onchainTxHash: string;
  amount: string;
}

/// Runs the full Deploy → Prove → Verify pipeline for one remittance
/// transaction: decode it, wait for + fetch its Attestcoin proof, and
/// submit it to RemittanceMicroLoan for on-chain verification. Idempotent
/// in effect — if the transfer is already recorded, the contract call
/// reverts with DuplicateTransfer via the registry, which the caller can
/// treat as a no-op rather than an error.
export async function submitRemittanceProofForTx(
  config: RemitCreditConfig,
  client: RemitCreditClient,
  borrower: string,
  sourceTxHash: string
): Promise<SubmitProofResult> {
  const sourceProvider = new JsonRpcProvider(config.sourceChain.rpcUrl);
  const proofService = new ProofService(config);

  const alreadyRecorded = await client.isTransferRecorded(sourceTxHash);
  if (alreadyRecorded) {
    throw new AlreadyRecordedError(sourceTxHash);
  }

  const decoded = await decodeErc20Remittance(sourceProvider, sourceTxHash);

  const borrowerRecord = await client.getBorrower(borrower);
  if (!borrowerRecord.registered) {
    throw new Error(`Borrower ${borrower} is not registered`);
  }
  const isApprovedSender = borrowerRecord.declaredSenders.some(
    (s) => s.toLowerCase() === decoded.sender.toLowerCase()
  );
  if (!isApprovedSender) {
    throw new Error(
      `Transaction sender ${decoded.sender} is not among ${borrower}'s declared remittance senders (${borrowerRecord.declaredSenders.join(", ")})`
    );
  }

  const proof = await proofService.buildProofForTransaction(sourceTxHash);

  const tx = await client.submitRemittanceProof(
    borrower,
    proof,
    decoded.sender,
    decoded.amount,
    decoded.sourceTimestamp
  );
  const receipt = await tx.wait();

  return {
    sourceTxHash,
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
