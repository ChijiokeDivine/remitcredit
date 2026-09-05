import { requireAuth, v1Handler } from "@/server/v1/http";
import { revokeSession } from "@/server/v1/auth";
import { v1Json } from "@/server/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  return v1Json({ address, authenticated: true }, 200, rid);
});

export const DELETE = v1Handler(async ({ req, rid }) => {
  const { token } = await requireAuth(req);
  await revokeSession(token);
  return v1Json({ revoked: true }, 200, rid);
});
