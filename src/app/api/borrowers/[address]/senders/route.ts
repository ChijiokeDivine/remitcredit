import { isAddress } from "ethers";
import { getReadClient } from "../../../../../server/contracts";
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

    const client = getReadClient();
    const senders = await client.getDeclaredSenders(address);
    return json({ borrower: address, declaredSenders: senders });
  } catch (err) {
    return toErrorResponse(err);
  }
}
