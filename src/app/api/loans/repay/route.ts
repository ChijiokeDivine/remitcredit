// src/app/api/loans/repay/route.ts
import { z } from "zod";
import { isAddress } from "ethers";
import { requireRelayerClient } from "@/server/contracts";
import { activityStore } from "@/server/store";
import { json, toErrorResponse, ApiError } from "@/server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const amountSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  amount: z
    .string()
    .regex(/^\d+$/, "amount must be a decimal string in the token's smallest unit"),
});

export async function POST(req: Request) {
  try {
    const { borrower, amount } = amountSchema.parse(await req.json());
    const client = requireRelayerClient();

    const allowance: bigint = await client.loanToken.allowance(
      borrower,
      await client.loan.getAddress()
    );
    if (allowance < BigInt(amount)) {
      throw new ApiError(
        400,
        `Borrower has not approved enough loan-token allowance to repay this amount. ` +
          `They must call approve() on the loan token from their own wallet first.`
      );
    }

    const tx = await client.repay(borrower, amount);
    const receipt = await tx.wait();
    const updated = await client.getBorrower(borrower);

    activityStore.append({
      borrower,
      type: "loan_repaid",
      data: {
        amount,
        newOutstanding: updated.outstandingPrincipal,
        txHash: receipt?.hash ?? tx.hash,
      },
    });

    return json({
      borrower,
      amount,
      newOutstanding: updated.outstandingPrincipal,
      txHash: receipt?.hash ?? tx.hash,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(
        new ApiError(400, err.errors[0]?.message ?? "Invalid body")
      );
    }
    return toErrorResponse(err);
  }
}