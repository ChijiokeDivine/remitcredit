// shared/types.ts

export interface RemittanceProofData {
  chainKey: number;
  blockHeight: number;
  txBytes: string; // hex-encoded raw transaction
  merkleProof: string; // hex-encoded, opaque to callers
  continuityProof: string; // hex-encoded, opaque to callers
  sourceTxHash: string;
}

export interface DecodedRemittance {
  sender: string;
  recipient: string; // the borrower's declared wallet
  amount: string; // decimal string in the token's smallest unit
  sourceTimestamp: number; // unix seconds
}

export interface BorrowerRecord {
  address: string;
  declaredSender: string;
  registered: boolean;
  eligible: boolean;
  creditLimit: string; // decimal string, smallest unit
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
