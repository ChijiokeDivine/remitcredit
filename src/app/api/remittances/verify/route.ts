// src/app/api/remittances/verify/route.ts
import { z } from "zod";
import { isAddress, isHexString } from "ethers";
import { getConfig } from "../../../../server/config";
import { activityStore } from "../../../../server/store";
import { json, toErrorResponse, ApiError } from "../../../../server/api-error";
import { RemitCreditClient } from "../../../../../shared/services/contractClient";
import { submitRemittanceProofForTx } from "../../../../../worker/src/submitProof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const verifySchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  sourceTxHash: z
    .string()
    .refine((v) => isHexString(v, 32), "sourceTxHash must be a 32-byte hex string"),
});

export async function POST(req: Request) {
  try {
    const { borrower, sourceTxHash } = verifySchema.parse(await req.json());
    const config = getConfig();

    if (!config.worker.privateKey) {
      throw new ApiError(503, "No submitter key configured (WORKER_PRIVATE_KEY unset)");
    }

    const signingClient = new RemitCreditClient(config, config.worker.privateKey);
    const result = await submitRemittanceProofForTx(
      config,
      signingClient,
      borrower,
      sourceTxHash
    );

    await activityStore.append({
      borrower,
      type: "remittance_verified",
      data: {
        sourceTxHash,
        onchainTxHash: result.onchainTxHash,
        amount: result.amount,
      },
    });

    return json(result, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(new ApiError(400, err.errors[0]?.message ?? "Invalid body"));
    }
    return toErrorResponse(err);
  }
}
