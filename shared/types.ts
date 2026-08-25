// shared/types.ts

export type UscMerkleProof = unknown;
export type UscContinuityProof = unknown;

export interface RemittanceProofData {
  chainKey: number;
  blockHeight: number;
  txBytes: string | Uint8Array;
  merkleProof: unknown;
  continuityProof: unknown;
  sourceTxHash: string;   // keccak256(txBytes) — what the contract needs
  realTxHash: string;     // the actual source-chain tx hash — for display/lookup only
}

export interface DecodedRemittance {
  sender: string;
  recipient: string;
  amount: string;
  sourceTimestamp: number;
}

/** Matches getBorrower + getDeclaredSenders on RemittanceMicroLoan. */
export interface BorrowerRecord {
  address: string;
  declaredSenders: string[];
  registered: boolean;
  eligible: boolean;
  creditLimit: string;
  riskScoreBps: number;
  outstandingPrincipal: string;
  lastReviewedAt: number;
}

export interface VerifiedTransferRecord {
  borrower: string;
  sender: string;
  amount: string;
  sourceTimestamp: number;
  sourceTxHash: string;
  recordedAt: number;
}

export interface RemittanceStatsView {
  transferCount: number;
  totalAmount: string;
  firstTimestamp: number;
  lastTimestamp: number;
  avgIntervalSeconds: number;
  intervalConsistencyBps: number;
}

export interface CreditDecisionView {
  eligible: boolean;
  creditLimit: string;
  riskScoreBps: number;
  rationale: string;
}

export interface LoanRequestResult {
  txHash: string;
  amount: string;
  newOutstanding: string;
}