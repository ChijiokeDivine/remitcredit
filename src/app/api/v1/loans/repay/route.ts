import { requireAuth, v1Handler, withIdempotency } from "@/server/v1/http";
import { repayBody } from "@/server/v1/schemas";
import { repayLoan } from "@/server/v1/services";
import { v1Json, V1Error } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return withIdempotency(req, address, rid, async () => {
    const body = await req.json().catch(() => { throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400); });
    const { amount } = repayBody.parse(body);
    return v1Json(await repayLoan(address, amount), 200, rid);
  });
});
