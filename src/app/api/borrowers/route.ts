import { z } from "zod";
import { isAddress } from "ethers";
import { requireRelayerClient } from "@/server/contracts";
import { activityStore } from "@/server/store";
import { json, toErrorResponse, ApiError } from "@/server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const registerSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  declaredSenders: z
    .array(z.string().refine(isAddress, "each sender must be a valid address"))
    .min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { borrower, declaredSenders } = registerSchema.parse(body);

    const client = requireRelayerClient();
    const tx = await client.registerBorrower(declaredSenders);
    const receipt = await tx.wait();

    activityStore.append({
      borrower,
      type: "borrower_registered",
      data: { declaredSenders, txHash: receipt?.hash ?? tx.hash },
    });

    return json(
      { borrower, declaredSenders, txHash: receipt?.hash ?? tx.hash },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(new ApiError(400, err.errors[0]?.message ?? "Invalid body"));
    }
    return toErrorResponse(err);
  }
}
