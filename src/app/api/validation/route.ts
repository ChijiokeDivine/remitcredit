// POST /api/validation  — trigger (or re-run) sender validation pipeline
// GET  /api/validation?sender=&recipient= — read latest off-chain + on-chain result
//
// Feature 3 surface for the explainable-score UI and ops tooling.

import { z } from "zod";
import { isAddress } from "ethers";
import { json, toErrorResponse, ApiError } from "@/server/api-error";
import {
  runSenderValidationPipeline,
  cacheValidationResult,
  getCachedValidationResult,
  readOnChainAttestation,
  type PipelineDeps,
} from "../../../../shared/services/senderValidationPipeline";
import { getSenderPairSnapshot } from "../../../../shared/services/senderLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  sender: z.string().refine(isAddress, "sender must be a valid address"),
  recipient: z.string().refine(isAddress, "recipient must be a valid address"),
  /** If true, wait for pipeline completion (default true for this endpoint). */
  awaitResult: z.boolean().optional().default(true),
});

function pipelineDeps(): PipelineDeps {
  const sourceRpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.ETHEREUM_MAINNET_RPC_URL ||
    process.env.SOURCE_RPC_URL;
  if (!sourceRpcUrl) {
    throw new ApiError(503, "Source chain RPC not configured");
  }
  return {
    sourceRpcUrl,
    creditcoinRpcUrl:
      process.env.CC3_TESTNET_RPC_URL ||
      process.env.CC3_MAINNET_RPC_URL ||
      undefined,
    attestationAddress:
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS_TESTNET ||
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS_MAINNET ||
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS ||
      undefined,
    writerPrivateKey:
      process.env.BACKEND_RELAYER_PRIVATE_KEY ||
      process.env.WORKER_PRIVATE_KEY ||
      undefined,
  };
}

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const deps = pipelineDeps();

    if (!body.awaitResult) {
      runSenderValidationPipeline(body.sender, body.recipient, deps)
        .then(cacheValidationResult)
        .catch((err) => console.error("[api/validation] background failed:", err));
      return json({ started: true, sender: body.sender, recipient: body.recipient }, 202);
    }

    const result = await runSenderValidationPipeline(
      body.sender,
      body.recipient,
      deps
    );
    cacheValidationResult(result);
    return json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(
        new ApiError(400, err.errors[0]?.message ?? "Invalid body")
      );
    }
    return toErrorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sender = url.searchParams.get("sender") ?? "";
    const recipient = url.searchParams.get("recipient") ?? "";
    if (!isAddress(sender) || !isAddress(recipient)) {
      throw new ApiError(400, "sender and recipient query params must be valid addresses");
    }

    const cached = getCachedValidationResult(sender, recipient);
    const snapshot = await getSenderPairSnapshot(sender, recipient);

    let onChain: Awaited<ReturnType<typeof readOnChainAttestation>> = null;
    const attAddr =
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS_TESTNET ||
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS_MAINNET ||
      process.env.SENDER_VALIDATION_ATTESTATION_ADDRESS;
    const ccRpc =
      process.env.CC3_TESTNET_RPC_URL || process.env.CC3_MAINNET_RPC_URL;
    if (attAddr && ccRpc) {
      onChain = await readOnChainAttestation(ccRpc, attAddr, sender, recipient);
    }

    return json({
      sender: sender.toLowerCase(),
      recipient: recipient.toLowerCase(),
      offChain: cached,
      onChain,
      probation: snapshot.probation,
      reputation: snapshot.reputation
        ? {
            totalVerifiedRemittances: snapshot.reputation.totalVerifiedRemittances,
            distinctRecipients: snapshot.reputation.distinctRecipients,
            riskFlags: snapshot.reputation.riskFlags,
            firstSeenAt: snapshot.reputation.firstSeenAt,
          }
        : null,
      weightExplanation: snapshot.weightExplanation,
      structuring: snapshot.structuring,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
