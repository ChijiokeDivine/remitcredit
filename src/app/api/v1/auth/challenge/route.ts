import { createChallenge } from "@/server/v1/auth";
import { challengeBody } from "@/server/v1/schemas";
import { v1Handler } from "@/server/v1/http";
import { v1Json, V1Error } from "@/server/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = v1Handler(async ({ req, rid }) => {
  const body = await req.json().catch(() => {
    throw new V1Error("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  });
  const { address } = challengeBody.parse(body);
  const challenge = await createChallenge(address);
  return v1Json({
    address: challenge.address, nonce: challenge.nonce, issuedAt: challenge.issuedAt,
    expirationTime: challenge.expirationTime, domain: challenge.domain, uri: challenge.uri,
    version: challenge.version, chainId: challenge.chainId, statement: challenge.statement,
    message: challenge.message,
  }, 200, rid);
});
