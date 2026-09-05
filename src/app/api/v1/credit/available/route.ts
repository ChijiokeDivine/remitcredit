import { requireAuth, v1Handler } from "@/server/v1/http";
import { getCreditLimit } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ req, rid }) => {
  const { address } = await requireAuth(req);
  const c = await getCreditLimit(address);
  return v1Json({ wallet: c.wallet, availableCredit: c.availableCredit, creditLimit: c.creditLimit, outstandingPrincipal: c.outstandingPrincipal }, 200, rid);
});
