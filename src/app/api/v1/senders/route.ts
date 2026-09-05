import { requireAuth, v1Handler, withIdempotency } from "@/server/v1/http";
import { addSenderBody, registerBody } from "@/server/v1/schemas";
import { listSenders, registerOrAddSenders, addSender } from "@/server/v1/services";
import { v1Json, V1Error } from "@/server/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return v1Json(await listSenders(address), 200, rid);
});

export const POST = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return withIdempotency(req, address, rid, async () => {
    const body = await req.json().catch(() => {
      throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
    });
    if (body && typeof body === "object" && "declaredSenders" in body) {
      const { declaredSenders } = registerBody.parse(body);
      return v1Json(await registerOrAddSenders(address, declaredSenders), 201, rid);
    }
    const { address: sender } = addSenderBody.parse(body);
    return v1Json(await addSender(address, sender), 201, rid);
  });
});
