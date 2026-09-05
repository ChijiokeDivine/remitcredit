import { requireAuth, v1Handler } from "@/server/v1/http";
import { listActivity } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 50;
  return v1Json(await listActivity(address, limit), 200, rid);
});
