// src/app/api/borrowers/route.ts
//
// PATCH of existing register route: after on-chain register / addDeclaredSender,
// run Feature 1–3 lifecycle hooks for each newly declared sender.

import { z } from "zod";
import { isAddress } from "ethers";
import { getReadClient, requireRelayerClient } from "@/server/contracts";
import { activityStore } from "@/server/store";
import { json, toErrorResponse, ApiError } from "@/server/api-error";
import { handleSenderDeclared } from "../../../../shared/services/senderLifecycle";

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

    const existing = await getReadClient().getBorrower(borrower);
    const alreadyDeclared = new Set(
      existing.declaredSenders.map((a) => a.toLowerCase())
    );

    const client = requireRelayerClient();
    const txHashes: string[] = [];
    let sendersToAdd = declaredSenders;
    const newlyDeclared: string[] = [];

    if (existing.registered) {
      // Borrower exists — add any new senders below.
    } else {
      const [firstSender, ...rest] = declaredSenders;
      const registerTx = await client.registerBorrower(borrower, firstSender);
      const registerReceipt = await registerTx.wait();
      txHashes.push(registerReceipt?.hash ?? registerTx.hash);
      alreadyDeclared.add(firstSender.toLowerCase());
      newlyDeclared.push(firstSender);
      sendersToAdd = rest;
    }

    for (const sender of sendersToAdd) {
      if (alreadyDeclared.has(sender.toLowerCase())) continue;
      const addTx = await client.addDeclaredSender(borrower, sender);
      const addReceipt = await addTx.wait();
      txHashes.push(addReceipt?.hash ?? addTx.hash);
      newlyDeclared.push(sender);
    }

    // Features 1–3 for every newly declared sender
    const hooks = [];
    for (const sender of newlyDeclared) {
      try {
        hooks.push(await handleSenderDeclared(sender, borrower));
      } catch (err) {
        console.error(
          `[borrowers] lifecycle hooks failed sender=${sender}:`,
          err
        );
      }
    }

    activityStore.append({
      borrower,
      type: "borrower_registered",
      data: {
        declaredSenders,
        txHash: txHashes[0] ?? null,
        txHashes,
        alreadyRegistered: existing.registered,
        newlyDeclared,
        validationJobsStarted: hooks.filter((h) => h.validationJobStarted).length,
      },
    });

    return json(
      {
        borrower,
        declaredSenders,
        txHash: txHashes[0] ?? null,
        txHashes,
        newlyDeclared,
        probation: hooks.map((h) => h.probation),
        validationJobsStarted: hooks.filter((h) => h.validationJobStarted).length,
      },
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
