import { isAddress } from "ethers";
import { getReadClient } from "../../../../../server/contracts";
import { json, toErrorResponse, ApiError } from "../../../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_SECONDS = 90 * 24 * 60 * 60; // 90 days

export async function GET(
  req: Request,
  ctx: { params: Promise<{ borrower: string }> }
) {
  try {
    const { borrower } = await ctx.params;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const url = new URL(req.url);
    const windowParam = url.searchParams.get("window");
    const windowSeconds = windowParam ? Number(windowParam) : DEFAULT_WINDOW_SECONDS;

    const client = getReadClient();
    const s = await client.getStats(borrower, windowSeconds);

    return json({
      borrower,
      windowSeconds,
      stats: {
        transferCount: s.transferCount,
        totalAmount: s.totalAmount,
        avgIntervalSeconds: s.avgIntervalSeconds,
        lastTransferAt: s.lastTimestamp,
        consistencyBps: s.intervalConsistencyBps,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}