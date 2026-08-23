import { isAddress } from "ethers";
import { getReadClient } from "../../../../server/contracts";
import { json, toErrorResponse, ApiError } from "../../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ borrower: string }> }
) {
  try {
    const { borrower } = await ctx.params;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const record = await client.getBorrower(borrower);
    const available = await client.getAvailableCredit(borrower);

    return json({
      borrower,
      registered: record.registered,
      creditLimit: record.creditLimit,
      outstandingPrincipal: record.outstandingPrincipal,
      availableCredit: available,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
