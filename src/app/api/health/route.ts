import { getConfig } from "../../../server/config";
import { json, toErrorResponse } from "../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getConfig();
    return json({ status: "ok", networkEnv: config.networkEnv });
  } catch (err) {
    return toErrorResponse(err);
  }
}
