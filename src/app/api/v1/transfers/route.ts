import { requireAuth, v1Handler } from "@/server/v1/http";
import { listTransfers } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return v1Json(await listTransfers(address), 200, rid);
});
