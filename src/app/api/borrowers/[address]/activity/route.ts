// src/app/api/borrowers/[address]/activity/route.ts
import { isAddress } from "ethers";
import { activityStore } from "../../../../../server/store";
import { json, toErrorResponse, ApiError } from "../../../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await ctx.params;
    if (!isAddress(address)) throw new ApiError(400, "Invalid address");
    return json({ events: await activityStore.listForBorrower(address) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
