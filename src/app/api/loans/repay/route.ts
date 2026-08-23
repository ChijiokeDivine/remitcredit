import { z } from "zod";
import { isAddress } from "ethers";
import { requireRelayerClient } from "../../../../server/contracts";
import { activityStore } from "../../../../server/store";
import { json, toErrorResponse, ApiError } from "../../../../server/api-error";

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

    // repay() pulls tokens from `borrower` via safeTransferFrom, so the
    // borrower must have approved the loan contract from their own wallet
    // first. Check the allowance up front so a missing approval surfaces
    // as a clear 400 instead of an on-chain revert.
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

    // requestLoan/repay are relayer-gated on-chain and take `borrower`
    // explicitly — the relayer wallet only authorizes and pays gas.
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
      return toErrorResponse(new ApiError(400, err.errors[0]?.message ?? "Invalid body"));
    }
    return toErrorResponse(err);
  }
}
