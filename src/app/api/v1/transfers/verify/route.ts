import { requireAuth, v1Handler, withIdempotency, assertSelf } from "@/server/v1/http";
import { verifyTransferBody } from "@/server/v1/schemas";
import { verifyTransfer } from "@/server/v1/services";
import { v1Json, V1Error } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const POST = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return withIdempotency(req, address, rid, async () => {
    const body = await req.json().catch(() => { throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400); });
    const parsed = verifyTransferBody.parse(body);
    const borrower = parsed.borrower ?? address;
    assertSelf(address, borrower);
    return v1Json(await verifyTransfer(borrower, parsed.txHash), 201, rid);
  });
});
