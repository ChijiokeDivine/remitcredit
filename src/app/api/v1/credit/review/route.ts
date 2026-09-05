import { requireAuth, v1Handler, withIdempotency } from "@/server/v1/http";
import { requestCreditReview } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return withIdempotency(req, address, rid, async () => v1Json(await requestCreditReview(address), 200, rid));
});
