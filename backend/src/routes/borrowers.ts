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

    const [firstSender, ...extraSenders] = declaredSenders;

    // registerBorrower/addDeclaredSender are relayer-gated on-chain and take
    // `borrower` explicitly — the relayer wallet only authorizes and pays
    // gas, it is never the on-chain borrower identity.
    const registerTx = await client.registerBorrower(borrower, firstSender);
    const registerReceipt = await registerTx.wait();

    const txHashes: string[] = [registerReceipt?.hash ?? registerTx.hash];

    for (const sender of extraSenders) {
      const addTx = await client.addDeclaredSender(borrower, sender);
      const addReceipt = await addTx.wait();
      txHashes.push(addReceipt?.hash ?? addTx.hash);
    }

    activityStore.append({
      borrower,
      type: "borrower_registered",
      data: { declaredSenders, txHash: txHashes[0], txHashes },
    });

    return json(
      { borrower, declaredSenders, txHash: txHashes[0], txHashes },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(new ApiError(400, err.errors[0]?.message ?? "Invalid body"));
    }
    return toErrorResponse(err);
  }
}