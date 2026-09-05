import { v1Handler } from "@/server/v1/http";
import { getProtocolInfo } from "@/server/v1/services";
import { v1Json } from "@/server/v1/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ rid }) => v1Json(await getProtocolInfo(), 200, rid));
