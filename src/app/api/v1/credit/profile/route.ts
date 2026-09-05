import { requireAuth, v1Handler } from "@/server/v1/http";
import { getCreditLimit, getCreditRationale } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  const [limit, rationale] = await Promise.all([getCreditLimit(address), getCreditRationale(address)]);
  return v1Json({ ...limit, ...rationale }, 200, rid);
});
