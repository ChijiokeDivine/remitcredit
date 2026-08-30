// src/app/api/activity/route.ts
import { activityStore } from "../../../server/store";
import { json, toErrorResponse } from "../../../server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;
    return json({ events: await activityStore.listAll(limit) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
