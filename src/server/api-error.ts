import { ContractCallError } from "../../shared/services/contractClient";
import { SenderNotApprovedError, AttestationPendingError } from "../../shared/errors";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Status code per known custom error name. Anything not listed falls back to 400. */
const CONTRACT_ERROR_STATUS: Record<string, number> = {
  NotRegistered: 404,
  SenderNotFound: 404,
  AlreadyRegistered: 409,
  SenderAlreadyDeclared: 409,
  DuplicateTransfer: 409,
  NotRelayer: 403,
  NotRecorder: 403,
  NotEligible: 403,
  ProofNotVerified: 422,
  TxHashMismatch: 400,
  SenderNotDeclared: 400,
  ZeroAmount: 400,
  ZeroAddress: 400,
  OutOfOrderTimestamp: 400,
  CreditLimitExceeded: 400,
  RepayExceedsOutstanding: 400,
  InsufficientPoolLiquidity: 503,
};

export function toErrorResponse(err: unknown): Response {
  if (err instanceof SenderNotApprovedError) {
    return json(
      {
        error: "SenderNotApproved",
        message: err.message,
        borrower: err.borrower,
        sender: err.sender,
        declaredSenders: err.declaredSenders,
      },
      403
    );
  }

  if (err instanceof AttestationPendingError) {
    return json(
      {
        error: "AttestationPending",
        message: err.message,
        chainKey: err.chainKey,
        targetHeight: err.targetHeight,
        latestAttestedHeight: err.latestAttestedHeight,
        retryAfterSeconds: err.retryAfterSeconds,
      },
      { status: 425, headers: { "Retry-After": String(err.retryAfterSeconds) } } as any
      // if your `json()` helper doesn't support extra headers, drop the
      // Retry-After line and just return 425 with the body above
    );
  }
  if (err instanceof ApiError) {
    return json({ error: err.message, details: err.details }, err.statusCode);
  }

  if (err instanceof ContractCallError) {
    const status = CONTRACT_ERROR_STATUS[err.errorName] ?? 400;
    return json(
      { error: err.errorName, message: err.message, args: err.args },
      status
    );
  }

  const message = err instanceof Error ? err.message : "Unknown error";

  // Missing env / config — surface as 503 so the UI can show a soft empty state
  if (message.includes("Missing required environment variable")) {
    console.error("[api] config error:", message);
    return json(
      {
        error: "Service not configured",
        message:
          "Server environment is incomplete. Set RPC URLs and contract addresses in Vercel env (or .env locally).",
      },
      503
    );
  }

  console.error("[api] unhandled error:", err);
  return json({ error: "Internal server error", message }, 500);
}

export function json(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    { status, headers: { "Content-Type": "application/json" } }
  );
}