import { requireAuth, v1Handler } from "@/server/v1/http";
import { getTransferStats } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  const window = new URL(req.url).searchParams.get("window");
  return v1Json(await getTransferStats(address, window ? Number(window) : undefined), 200, rid);
});
