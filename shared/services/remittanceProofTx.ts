// shared/services/remittanceProofTx.ts
import { JsonRpcProvider, TransactionResponse } from "ethers";
import { RemitCreditConfig } from "../config";
import { ProofService } from "./proofService";
import { RemitCreditClient } from "./contractClient";
import { decodeErc20Remittance } from "./txDecoder";
import { SenderNotApprovedError } from "../errors";

export interface SentProofTx {
  tx: TransactionResponse;
  borrower: string;
  sourceTxHash: string; // the real source-chain tx hash
  onchainSourceTxHash: string; // keccak256(txBytes) — the on-chain dedupe key
}

export class AlreadyRecordedError extends Error {
  constructor(sourceTxHash: string) {
    super(`Transaction ${sourceTxHash} is already recorded in the credit registry`);
    this.name = "AlreadyRecordedError";
  }
}

/// Same Deploy -> Prove -> Verify pipeline as submitRemittanceProofForTx,
/// but returns as soon as the transaction is broadcast rather than
/// awaiting tx.wait(). Built for callers that can't block for a
/// confirmation inside one invocation (a Vercel Function has a hard
/// execution-time ceiling) — pair this with inFlightTxStore, which checks
/// back for the receipt on a later tick.
export async function sendRemittanceProofTx(
  config: RemitCreditConfig,
  client: RemitCreditClient,
  borrower: string,
  sourceTxHash: string
): Promise<SentProofTx> {
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

  const alreadyRecorded = await client.isTransferRecorded(proof.sourceTxHash);
  if (alreadyRecorded) {
    throw new AlreadyRecordedError(proof.realTxHash);
  }

  const tx = await client.submitRemittanceProof(
    borrower,
    proof,
    decoded.sender,
    decoded.amount,
    decoded.sourceTimestamp
  );

  return {
    tx,
    borrower,
    sourceTxHash: proof.realTxHash,
    onchainSourceTxHash: proof.sourceTxHash,
  };
}