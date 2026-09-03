// src/app/api/borrowers/senders/route.ts
//
// PATCH of existing route: after successful add/remove on-chain, run
// Feature 1–3 lifecycle hooks (probation, reputation, validation pipeline).
// Does NOT change the existing contract call surface.

import { z } from "zod";
import { isAddress } from "ethers";
import { requireRelayerClient } from "@/server/contracts";
import { activityStore } from "@/server/store";
import { json, toErrorResponse, ApiError } from "@/server/api-error";
import { handleSenderDeclared } from "../../../../../shared/services/senderLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const senderSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  sender: z.string().refine(isAddress, "sender must be a valid address"),
});

export async function POST(req: Request) {
  try {
    const { borrower, sender } = senderSchema.parse(await req.json());
    const client = requireRelayerClient();
    const tx = await client.addDeclaredSender(borrower, sender);
    const receipt = await tx.wait();

    // Features 1–3: probation row, cross-corridor reputation, async validation
    const hooks = await handleSenderDeclared(sender, borrower);

    await activityStore.append({
      borrower,
      type: "borrower_registered",
      data: {
        action: "sender_added",
        sender,
        txHash: receipt?.hash ?? tx.hash,
        probationStatus: hooks.probation.status,
        weightBps: hooks.probation.weightBps,
        validationJobStarted: hooks.validationJobStarted,
      },
    });

    return json(
      {
        borrower,
        sender,
        txHash: receipt?.hash ?? tx.hash,
        probation: hooks.probation,
        reputation: {
          totalVerifiedRemittances: hooks.reputation.totalVerifiedRemittances,
          distinctRecipients: hooks.reputation.distinctRecipients,
          riskFlags: hooks.reputation.riskFlags,
        },
        validationJobStarted: hooks.validationJobStarted,
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

export async function DELETE(req: Request) {
  try {
    const { borrower, sender } = senderSchema.parse(await req.json());
    const client = requireRelayerClient();
    const tx = await client.removeDeclaredSender(borrower, sender);
    const receipt = await tx.wait();

    await activityStore.append({
      borrower,
      type: "borrower_registered",
      data: {
        action: "sender_removed",
        sender,
        txHash: receipt?.hash ?? tx.hash,
      },
    });

    return json({ borrower, sender, txHash: receipt?.hash ?? tx.hash });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(
        new ApiError(400, err.errors[0]?.message ?? "Invalid body")
      );
    }
    return toErrorResponse(err);
  }
}
