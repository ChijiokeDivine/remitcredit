// shared/services/creditAgent.ts
//
// A TypeScript mirror of CreditDecisionEngine.sol's `decide()` function.
// This is intentionally the *same* deterministic rules, just runnable
// off-chain: the backend uses it to preview a borrower's decision for a
// future frontend without spending gas, and the worker's agent loop uses
// it to decide whether a fresh remittance actually changes anything before
// it bothers sending an on-chain requestCreditReview transaction.
//
// Keep this in sync with contracts/CreditDecisionEngine.sol by hand — for
// a production system, generating one from the other (or reading `params`
// on-chain, as done here) would remove the risk of drift.
import { RemittanceStatsView, CreditDecisionView } from "../types";

export interface CreditAgentParams {
  minTransferCount: number;
  minTotalAmount: bigint;
  minConsistencyBps: number;
  creditMultiplierBps: number;
  maxCreditLimit: bigint;
  lookbackWindowSeconds: number;
  maxStalenessSeconds: number;
}

export function decideCreditLine(
  stats: RemittanceStatsView,
  params: CreditAgentParams,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000)
): CreditDecisionView {
  if (stats.transferCount < params.minTransferCount) {
    return notEligible("Not enough verified remittances yet to establish a pattern.");
  }

  const totalAmount = BigInt(stats.totalAmount);
  if (totalAmount < params.minTotalAmount) {
    return notEligible("Verified inflow below the minimum required to qualify.");
  }

  if (stats.intervalConsistencyBps < params.minConsistencyBps) {
    return notEligible("Remittances are too irregular to size a credit line on.");
  }

  const staleness = nowUnixSeconds - stats.lastTimestamp;
  if (staleness > params.maxStalenessSeconds) {
    return notEligible("Most recent verified remittance is too old.");
  }

  const rawLimit = (totalAmount * BigInt(params.creditMultiplierBps)) / 10000n;
  const creditLimit = rawLimit > params.maxCreditLimit ? params.maxCreditLimit : rawLimit;

  const countConfidenceBps = Math.min(
    10000,
    Math.floor((stats.transferCount * 10000) / (params.minTransferCount * 2))
  );
  const riskScoreBps = Math.floor((stats.intervalConsistencyBps + countConfidenceBps) / 2);

  return {
    eligible: creditLimit > 0n,
    creditLimit: creditLimit.toString(),
    riskScoreBps,
    rationale: "Eligible: credit limit sized from verified remittance inflow and regularity.",
  };
}

function notEligible(rationale: string): CreditDecisionView {
  return { eligible: false, creditLimit: "0", riskScoreBps: 0, rationale };
}

/// Human-readable explanation of a decision, meant for a future
/// frontend's "why did I get this limit?" panel. Kept separate from the
/// on-chain rationale string so it can be richer without costing gas.
export function explainDecision(stats: RemittanceStatsView, decision: CreditDecisionView): string[] {
  const lines: string[] = [];
  lines.push(`${stats.transferCount} verified remittance(s) found in the review window.\n`);
  if (stats.transferCount > 0) {
    lines.push(`Total verified inflow: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(stats.totalAmount) / 1000000)}.\n`);
    lines.push(`Interval consistency score: ${(stats.intervalConsistencyBps / 100).toFixed(1)}%.\n`);
  }
  lines.push(decision.eligible
    ? `Approved for a credit limit of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(decision.creditLimit) / 1000000)}, risk score ${(decision.riskScoreBps / 100).toFixed(1)}%.\n`
    : `Not currently eligible: ${decision.rationale}\n`);
  return lines;
}