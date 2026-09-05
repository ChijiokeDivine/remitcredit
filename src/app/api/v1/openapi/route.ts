import { v1Handler } from "@/server/v1/http";
import { v1Json } from "@/server/v1/errors";
import { openApiSpec } from "@/server/v1/openapi-spec";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = v1Handler(async ({ rid }) => v1Json(openApiSpec, 200, rid));
