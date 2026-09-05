import { isAddress, getAddress } from "ethers";
import { requireAuth, v1Handler, withIdempotency } from "@/server/v1/http";
import { isSenderDeclared, removeSender } from "@/server/v1/services";
import { v1Json, V1Error } from "@/server/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = v1Handler(async ({ req, rid }) => {
  const { address: auth } = await requireAuth(req);
  const sender = new URL(req.url).pathname.split("/").pop()!;
  if (!sender || !isAddress(sender)) throw new V1Error("VALIDATION_ERROR", "Invalid sender address.", 400);
  return v1Json(await isSenderDeclared(auth, sender), 200, rid);
});

export const DELETE = v1Handler(async ({ req, rid }) => {
  const { address: auth } = await requireAuth(req);
  const sender = new URL(req.url).pathname.split("/").pop()!;
  if (!sender || !isAddress(sender)) throw new V1Error("VALIDATION_ERROR", "Invalid sender address.", 400);
  return withIdempotency(req, auth, rid, async () => {
    return v1Json(await removeSender(auth, getAddress(sender)), 200, rid);
  });
});
