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
    if (!record.registered) throw new ApiError(404, "Borrower not registered");
    const available = await client.getAvailableCredit(borrower);

    return json({
      borrower,
      creditLimit: record.creditLimit,
      outstandingPrincipal: record.outstandingPrincipal,
      availableCredit: available,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
