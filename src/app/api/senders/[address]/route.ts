// GET /api/senders/:address
// Cross-corridor reputation snapshot for a sender wallet (Feature 2).

import { isAddress } from "ethers";
import { json, toErrorResponse, ApiError } from "@/server/api-error";
import {
  getReputation,
  detectStructuring,
} from "../../../../../shared/services/reputationService";
import { senderProbationStore } from "../../../../../shared/services/senderProbationStore";
import { explainWeight, loadProbationConfig } from "../../../../../shared/services/probationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await ctx.params;
    if (!isAddress(address)) throw new ApiError(400, "Invalid address");

    const [reputation, pairs] = await Promise.all([
      getReputation(address),
      senderProbationStore.listForSender(address, 50),
    ]);

    const cfg = loadProbationConfig();
    const pairSummaries = pairs.map((p) => ({
      recipient: p.recipient,
      status: p.status,
      verifiedTransferCount: p.verifiedTransferCount,
      weightBps: p.weightBps,
      declaredAt: p.declaredAt,
      explanation: explainWeight(p, cfg),
    }));

    return json({
      sender: address.toLowerCase(),
      reputation: reputation
        ? {
            totalVerifiedRemittances: reputation.totalVerifiedRemittances,
            distinctRecipients: reputation.distinctRecipients,
            firstSeenAt: reputation.firstSeenAt,
            totalVolume: reputation.totalVolume,
            avgTransferSize: reputation.avgTransferSize,
            riskFlags: reputation.riskFlags,
            // Privacy: no recipient list in the shared registry
          }
        : null,
      structuring: reputation ? detectStructuring(reputation) : null,
      pairs: pairSummaries,
      probationConfig: {
        minDays: cfg.minDays,
        minTransfers: cfg.minTransfers,
        minSeconds: cfg.minSeconds ?? null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
