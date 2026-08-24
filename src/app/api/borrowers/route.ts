// src/app/api/borrowers/route.ts
import { z } from "zod";
import { isAddress } from "ethers";
import { getReadClient, requireRelayerClient } from "@/server/contracts";
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

    // Read-only pre-check so this endpoint is safe to retry/double-submit.
    const existing = await getReadClient().getBorrower(borrower);
    const alreadyDeclared = new Set(
      existing.declaredSenders.map((a) => a.toLowerCase())
    );

    const client = requireRelayerClient();
    const txHashes: string[] = [];
    let sendersToAdd = declaredSenders;

    if (existing.registered) {
      // Borrower exists — nothing to register, just add any new senders below.
    } else {
      const [firstSender, ...rest] = declaredSenders;
      const registerTx = await client.registerBorrower(borrower, firstSender);
      const registerReceipt = await registerTx.wait();
      txHashes.push(registerReceipt?.hash ?? registerTx.hash);
      alreadyDeclared.add(firstSender.toLowerCase());
      sendersToAdd = rest;
    }

    for (const sender of sendersToAdd) {
      if (alreadyDeclared.has(sender.toLowerCase())) continue; // avoid SenderAlreadyDeclared
      const addTx = await client.addDeclaredSender(borrower, sender);
      const addReceipt = await addTx.wait();
      txHashes.push(addReceipt?.hash ?? addTx.hash);
    }

    activityStore.append({
      borrower,
      type:  "borrower_registered",
      data: { declaredSenders, txHash: txHashes[0] ?? null, txHashes,  alreadyRegistered: existing.registered },
    });

    return json(
      { borrower, declaredSenders, txHash: txHashes[0] ?? null, txHashes },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(
        new ApiError(400, err.errors[0]?.message ?? "Invalid body")
      );
    }
    return toErrorResponse(err);
  }
}