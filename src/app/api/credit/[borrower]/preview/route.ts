import { isAddress } from "ethers";
import { getReadClient } from "@/server/contracts";
import {
  decideCreditLine,
  explainDecision,
} from "../../../../../../shared/services/creditAgent";
import { json, toErrorResponse, ApiError } from "../../../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ borrower: string }> }
) {
  try {
    const { borrower } = await ctx.params;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const q = new URL(req.url).searchParams;
    const params = {
      minTransferCount: Number(q.get("minTransferCount") ?? 3),
      minTotalAmount: BigInt(String(q.get("minTotalAmount") ?? "300000000")),
      minConsistencyBps: Number(q.get("minConsistencyBps") ?? 5000),
      creditMultiplierBps: Number(q.get("creditMultiplierBps") ?? 3000),
      maxCreditLimit: BigInt(String(q.get("maxCreditLimit") ?? "1000000000")),
      lookbackWindowSeconds: Number(
        q.get("lookbackWindowSeconds") ?? 180 * 24 * 60 * 60
      ),
      maxStalenessSeconds: Number(
        q.get("maxStalenessSeconds") ?? 60 * 24 * 60 * 60
      ),
    };

    const client = getReadClient();
    const stats = await client.getStats(borrower, params.lookbackWindowSeconds);
    const decision = decideCreditLine(stats, params);
    const rationale = explainDecision(stats, decision);

    return json({ borrower, stats, decision, rationale });
  } catch (err) {
    return toErrorResponse(err);
  }
}
