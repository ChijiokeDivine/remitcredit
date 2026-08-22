import { isAddress } from "ethers";
import { getReadClient } from "../../../../../server/contracts";
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

    const windowSeconds = Number(
      new URL(req.url).searchParams.get("window") ?? 180 * 24 * 60 * 60
    );

    const client = getReadClient();
    const stats = await client.getStats(borrower, windowSeconds);
    return json({ borrower, windowSeconds, stats });
  } catch (err) {
    return toErrorResponse(err);
  }
}
