// backend/src/routes/credit.ts
import { Router } from "express";
import { isAddress } from "ethers";
import { asyncRoute, ApiError } from "../middleware/errorHandler";
import { getReadClient, requireRelayerClient } from "../services/contracts";
import { decideCreditLine } from "../../../shared/services/creditAgent";
import { explainDecision } from "../../../shared/services/creditAgent";
import { activityStore } from "../store";

export const creditRouter = Router();

/// GET /credit/:borrower — current on-chain decision (eligibility, credit
/// limit, risk score) as last computed by requestCreditReview.
creditRouter.get(
  "/:borrower",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const record = await client.getBorrower(borrower);
    if (!record.registered) throw new ApiError(404, "Borrower not registered");

    res.json({
      borrower,
      eligible: record.eligible,
      creditLimit: record.creditLimit,
      riskScoreBps: record.riskScoreBps,
      lastReviewedAt: record.lastReviewedAt,
    });
  })
);

/// GET /credit/:borrower/preview — off-chain preview of what a decision
/// would be right now, with a plain-language rationale, without spending
/// gas or waiting for the worker's agent loop. Params must be passed
/// explicitly since this route doesn't assume a single fixed policy —
/// mirrors contracts/CreditDecisionEngine.sol's `Params` struct.
creditRouter.get(
  "/:borrower/preview",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const params = {
      minTransferCount: Number(req.query.minTransferCount ?? 3),
      minTotalAmount: BigInt(String(req.query.minTotalAmount ?? "300000000")),
      minConsistencyBps: Number(req.query.minConsistencyBps ?? 5000),
      creditMultiplierBps: Number(req.query.creditMultiplierBps ?? 3000),
      maxCreditLimit: BigInt(String(req.query.maxCreditLimit ?? "1000000000")),
      lookbackWindowSeconds: Number(req.query.lookbackWindowSeconds ?? 180 * 24 * 60 * 60),
      maxStalenessSeconds: Number(req.query.maxStalenessSeconds ?? 60 * 24 * 60 * 60),
    };

    const client = getReadClient();
    const stats = await client.getStats(borrower, params.lookbackWindowSeconds);
    const decision = decideCreditLine(stats, params);
    const rationale = explainDecision(stats, decision);

    res.json({ borrower, stats, decision, rationale });
  })
);

/// POST /credit/:borrower/review — trigger an on-chain requestCreditReview.
/// Normally the worker's agent loop does this automatically after a new
/// verified remittance; this lets a frontend offer a manual "recheck my
/// limit" action.
creditRouter.post(
  "/:borrower/review",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = requireRelayerClient();
    const tx = await client.requestCreditReview(borrower);
    const receipt = await tx.wait();

    const record = await client.getBorrower(borrower);

    activityStore.append({
      borrower,
      type: "credit_reviewed",
      data: {
        eligible: record.eligible,
        creditLimit: record.creditLimit,
        riskScoreBps: record.riskScoreBps,
        txHash: receipt?.hash ?? tx.hash,
      },
    });

    res.json({ borrower, ...record, txHash: receipt?.hash ?? tx.hash });
  })
);
