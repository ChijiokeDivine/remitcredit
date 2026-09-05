import { verifyChallenge } from "@/server/v1/auth";
import { verifyBody } from "@/server/v1/schemas";
import { v1Handler } from "@/server/v1/http";
import { v1Json, V1Error } from "@/server/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = v1Handler(async ({ req, rid }) => {
  const body = await req.json().catch(() => {
    throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  });
  const { message, signature } = verifyBody.parse(body);
  const session = await verifyChallenge(message, signature);
  return v1Json({
    token: session.token, tokenType: "Bearer", address: session.address,
    issuedAt: session.issuedAt, expiresAt: session.expiresAt,
  }, 200, rid);
});
