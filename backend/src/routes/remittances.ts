// backend/src/routes/remittances.ts
import { Router } from "express";
import { z } from "zod";
import { isAddress, isHexString } from "ethers";
import { asyncRoute, ApiError } from "../middleware/errorHandler";
import { getReadClient } from "../services/contracts";
import { submitRemittanceProofForTx } from "../../../worker/src/submitProof";
import { RemitCreditClient } from "../../../shared/services/contractClient";
import { getConfig } from "../env";
import { activityStore } from "../store";

export const remittancesRouter = Router();

const verifySchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  sourceTxHash: z.string().refine((v) => isHexString(v, 32), "sourceTxHash must be a 32-byte hex string"),
});

/// POST /remittances/verify — manually trigger the prove-and-submit
/// pipeline for one source-chain transaction. This is the same pipeline
/// the worker's monitor runs automatically; exposing it here lets a
/// frontend offer a "I just sent it, verify now" button instead of waiting
/// for the poller, and lets the demo be driven without the worker running.
remittancesRouter.post(
  "/verify",
  asyncRoute(async (req, res) => {
    const { borrower, sourceTxHash } = verifySchema.parse(req.body);
    const config = getConfig();

    // submitRemittanceProofForTx needs a signer to submit the verified
    // proof on-chain, so this endpoint requires WORKER_PRIVATE_KEY to be
    // set. See requireRelayerClient in services/contracts.ts for the
    // non-custodial pattern used by the loan/credit write routes instead.
    if (!config.worker.privateKey) {
      throw new ApiError(500, "No submitter key configured (WORKER_PRIVATE_KEY unset)");
    }
    const signingClient = new RemitCreditClient(config, config.worker.privateKey);
    const result = await submitRemittanceProofForTx(config, signingClient, borrower, sourceTxHash);

    activityStore.append({
      borrower,
      type: "remittance_verified",
      data: { sourceTxHash, onchainTxHash: result.onchainTxHash, amount: result.amount },
    });

    res.status(201).json(result);
  })
);

/// GET /remittances/:borrower — full verified transfer history.
remittancesRouter.get(
  "/:borrower",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const transfers = await client.getVerifiedTransfers(borrower);
    res.json({ borrower, transfers });
  })
);

/// GET /remittances/:borrower/stats?window=<seconds> — rolling stats used
/// by the credit decision engine, exposed directly so a frontend can show
/// "why" without re-deriving it from the raw transfer list.
remittancesRouter.get(
  "/:borrower/stats",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");
    const windowSeconds = Number(req.query.window ?? 180 * 24 * 60 * 60);

    const client = getReadClient();
    const stats = await client.getStats(borrower, windowSeconds);
    res.json({ borrower, windowSeconds, stats });
  })
);
