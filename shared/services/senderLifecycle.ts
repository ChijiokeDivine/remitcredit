// shared/services/senderLifecycle.ts
//
// Glue between declaration / transfer webhooks and Features 1–3.
// Import from API routes without pulling the whole pipeline into every path.

import { onSenderDeclared, onVerifiedTransfer, explainWeight } from "./probationService";
import {
  onNewCorridor,
  onVerifiedRemittance,
  ensureSenderReputation,
  getReputation,
  detectStructuring,
} from "./reputationService";
import {
  runSenderValidationPipeline,
  cacheValidationResult,
  type PipelineDeps,
  type ValidationResult,
} from "./senderValidationPipeline";
import { senderProbationStore } from "./senderProbationStore";

export interface DeclarationHooksResult {
  probation: Awaited<ReturnType<typeof onSenderDeclared>>;
  reputation: Awaited<ReturnType<typeof onNewCorridor>>;
  /** Pipeline kicked off asynchronously; not awaited by default. */
  validationJobStarted: boolean;
}

/**
 * Call after a successful on-chain registerBorrower / addDeclaredSender.
 * Starts the async validation pipeline (Feature 3) and initializes
 * probation + reputation rows (Features 1–2).
 */
export async function handleSenderDeclared(
  sender: string,
  recipient: string,
  opts?: {
    /** When true, await the full validation pipeline (slower). Default: fire-and-forget. */
    awaitValidation?: boolean;
    pipelineDeps?: PipelineDeps;
  }
): Promise<DeclarationHooksResult> {
  const existing = await senderProbationStore.get(sender, recipient);
  const isNewPair = !existing;

  const [probation, reputation] = await Promise.all([
    onSenderDeclared(sender, recipient),
    (async () => {
      await ensureSenderReputation(sender);
      return onNewCorridor(sender, isNewPair);
    })(),
  ]);

  let validationJobStarted = false;
  const deps = opts?.pipelineDeps ?? buildPipelineDepsFromEnv();

  if (deps?.sourceRpcUrl) {
    const job = runSenderValidationPipeline(sender, recipient, deps).then(
      (result) => {
        cacheValidationResult(result);
        return result;
      }
    );
    validationJobStarted = true;
    if (opts?.awaitValidation) {
      await job;
    } else {
      job.catch((err) =>
        console.error(
          `[senderLifecycle] validation pipeline failed sender=${sender} recipient=${recipient}:`,
          err
        )
      );
    }
  }

  return { probation, reputation, validationJobStarted };
}

/**
 * Call from the Alchemy remittance webhook (or after proof confirms)
 * for each tracked transfer. Updates probation counts + global reputation.
 * Returns the weight that should be applied when attributing this transfer
 * to the recipient's *off-chain* explainable score.
 */
export async function handleVerifiedTransfer(
  sender: string,
  recipient: string,
  amount: string | bigint
): Promise<{
  weightBps: number;
  graduated: boolean;
  explanation: string;
  structuring: ReturnType<typeof detectStructuring> | null;
}> {
  const { record, weightBps, graduated } = await onVerifiedTransfer(
    sender,
    recipient
  );
  const rep = await onVerifiedRemittance(sender, amount);
  const structuring = detectStructuring(rep);

  return {
    weightBps,
    graduated,
    explanation: explainWeight(record),
    structuring,
  };
}

export async function getSenderPairSnapshot(sender: string, recipient: string) {
  const [probation, reputation] = await Promise.all([
    senderProbationStore.get(sender, recipient),
    getReputation(sender),
  ]);
  return {
    probation,
    reputation,
    structuring: reputation ? detectStructuring(reputation) : null,
    weightExplanation: probation ? explainWeight(probation) : null,
  };
}

function buildPipelineDepsFromEnv(): PipelineDeps | null {
  const sourceRpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.ETHEREUM_MAINNET_RPC_URL ||
    process.env.SOURCE_RPC_URL;
  if (!sourceRpcUrl) return null;

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

export type { ValidationResult, PipelineDeps };
