import { isAddress } from "ethers";
import { getReadClient } from "../../../../server/contracts";
import { json, toErrorResponse, ApiError } from "../../../../server/api-error";

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
    const record = await client.getBorrower(address);
    if (!record.registered) throw new ApiError(404, "Borrower not registered");

    return json(record);
  } catch (err) {
    return toErrorResponse(err);
  }
}
