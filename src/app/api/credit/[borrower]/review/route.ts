// src/app/api/credit/[borrower]/review/route.ts
import { isAddress } from "ethers";
import { requireRelayerClient } from "../../../../../server/contracts";
import { activityStore } from "../../../../../server/store";
import { json, toErrorResponse, ApiError } from "../../../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ borrower: string }> }
) {
  try {
    const { borrower } = await ctx.params;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = requireRelayerClient();
    const tx = await client.requestCreditReview(borrower);
    const receipt = await tx.wait();
    const record = await client.getBorrower(borrower);

    await activityStore.append({
      borrower,
      type: "credit_reviewed",
      data: {
        eligible: record.eligible,
        creditLimit: record.creditLimit,
        riskScoreBps: record.riskScoreBps,
        txHash: receipt?.hash ?? tx.hash,
      },
    });

    return json({ borrower, ...record, txHash: receipt?.hash ?? tx.hash });
  } catch (err) {
    return toErrorResponse(err);
  }
}
