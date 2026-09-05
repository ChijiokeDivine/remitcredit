// src/server/v1/errors.ts
import { ContractCallError } from "../../../shared/services/contractClient";
import { SenderNotApprovedError, AttestationPendingError } from "../../../shared/errors";
import { ApiError as LegacyApiError } from "../api-error";

export type ErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT" | "BUSINESS_RULE_VIOLATION" | "INSUFFICIENT_CREDIT"
  | "NOT_REGISTERED" | "NOT_ELIGIBLE" | "SENDER_NOT_DECLARED" | "SENDER_ALREADY_DECLARED"
  | "ALREADY_REGISTERED" | "DUPLICATE_TRANSFER" | "PROOF_NOT_VERIFIED" | "ATTESTATION_PENDING"
  | "SENDER_NOT_APPROVED" | "REPAY_EXCEEDS_OUTSTANDING" | "INSUFFICIENT_ALLOWANCE"
  | "INSUFFICIENT_POOL_LIQUIDITY" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE"
  | "UPSTREAM_FAILURE" | "INTERNAL_ERROR";

export class V1Error extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "V1Error";
  }
}

const CONTRACT_MAP: Record<string, { code: ErrorCode; status: number; retryable?: boolean }> = {
  NotRegistered: { code: "NOT_REGISTERED", status: 404 },
  AlreadyRegistered: { code: "ALREADY_REGISTERED", status: 409 },
  SenderNotFound: { code: "NOT_FOUND", status: 404 },
  SenderAlreadyDeclared: { code: "SENDER_ALREADY_DECLARED", status: 409 },
  SenderNotDeclared: { code: "SENDER_NOT_DECLARED", status: 400 },
  DuplicateTransfer: { code: "DUPLICATE_TRANSFER", status: 409 },
  NotRelayer: { code: "FORBIDDEN", status: 403 },
  NotRecorder: { code: "FORBIDDEN", status: 403 },
  NotEligible: { code: "NOT_ELIGIBLE", status: 403 },
  ProofNotVerified: { code: "PROOF_NOT_VERIFIED", status: 422 },
  TxHashMismatch: { code: "VALIDATION_ERROR", status: 400 },
  ZeroAmount: { code: "VALIDATION_ERROR", status: 400 },
  ZeroAddress: { code: "VALIDATION_ERROR", status: 400 },
  OutOfOrderTimestamp: { code: "VALIDATION_ERROR", status: 400 },
  CreditLimitExceeded: { code: "INSUFFICIENT_CREDIT", status: 422 },
  RepayExceedsOutstanding: { code: "REPAY_EXCEEDS_OUTSTANDING", status: 422 },
  InsufficientPoolLiquidity: { code: "INSUFFICIENT_POOL_LIQUIDITY", status: 503, retryable: true },
};

export function toV1Error(err: unknown): V1Error {
  if (err instanceof V1Error) return err;
  if (err instanceof SenderNotApprovedError) {
    return new V1Error("SENDER_NOT_APPROVED", err.message, 403, {
      borrower: err.borrower, sender: err.sender, declaredSenders: err.declaredSenders,
    });
  }
  if (err instanceof AttestationPendingError) {
    return new V1Error("ATTESTATION_PENDING", err.message, 425, {
      chainKey: err.chainKey, targetHeight: err.targetHeight,
      latestAttestedHeight: err.latestAttestedHeight, retryAfterSeconds: err.retryAfterSeconds,
    }, true);
  }
  if (err instanceof ContractCallError) {
    const mapped = CONTRACT_MAP[err.errorName];
    if (mapped) {
      const details: Record<string, unknown> = { contractError: err.errorName };
      if (err.errorName === "CreditLimitExceeded" && err.args.length >= 2) {
        details.requested = String(err.args[0]); details.available = String(err.args[1]);
      }
      if (err.errorName === "RepayExceedsOutstanding" && err.args.length >= 2) {
        details.amount = String(err.args[0]); details.outstanding = String(err.args[1]);
      }
      if (err.errorName === "InsufficientPoolLiquidity" && err.args.length >= 2) {
        details.requested = String(err.args[0]); details.available = String(err.args[1]);
      }
      if (err.errorName === "SenderNotDeclared" && err.args[0]) details.claimed = String(err.args[0]);
      return new V1Error(mapped.code, humanize(err.errorName, err.args), mapped.status, details, mapped.retryable ?? false);
    }
    return new V1Error("BUSINESS_RULE_VIOLATION", err.message, 400, { contractError: err.errorName, args: err.args.map(String) });
  }
  if (err instanceof LegacyApiError) {
    const code: ErrorCode =
      err.statusCode === 401 ? "UNAUTHORIZED" :
      err.statusCode === 403 ? "FORBIDDEN" :
      err.statusCode === 404 ? "NOT_FOUND" :
      err.statusCode === 409 ? "CONFLICT" :
      err.statusCode === 422 ? "BUSINESS_RULE_VIOLATION" :
      err.statusCode === 503 ? "SERVICE_UNAVAILABLE" : "VALIDATION_ERROR";
    return new V1Error(code, err.message, err.statusCode,
      err.details && typeof err.details === "object" ? (err.details as Record<string, unknown>) : undefined,
      err.statusCode >= 500);
  }
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "ZodError") {
    const ze = err as { errors?: Array<{ message?: string }> };
    return new V1Error("VALIDATION_ERROR", ze.errors?.[0]?.message ?? "Invalid request", 400, { issues: ze.errors });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  if (message.includes("Missing required environment variable")) {
    return new V1Error("SERVICE_UNAVAILABLE", "Server environment is incomplete.", 503, undefined, true);
  }
  if (message.includes("network") || message.includes("ECONNREFUSED") || message.includes("timeout")) {
    return new V1Error("UPSTREAM_FAILURE", "Upstream blockchain or Redis provider failed. Retry shortly.", 502, undefined, true);
  }
  console.error("[api/v1] unhandled:", err);
  return new V1Error("INTERNAL_ERROR", "An unexpected error occurred.", 500, undefined, true);
}

function humanize(name: string, args: unknown[]): string {
  switch (name) {
    case "CreditLimitExceeded": return `Requested amount exceeds available credit${args.length >= 2 ? ` (requested ${args[0]}, available ${args[1]})` : ""}.`;
    case "RepayExceedsOutstanding": return `Repayment exceeds outstanding principal${args.length >= 2 ? ` (amount ${args[0]}, outstanding ${args[1]})` : ""}.`;
    case "NotRegistered": return "Borrower is not registered. Complete onboarding first.";
    case "AlreadyRegistered": return "Borrower is already registered.";
    case "NotEligible": return "Borrower is not eligible for a loan under current credit rules.";
    case "SenderNotDeclared": return `Sender is not declared for this borrower${args[0] ? ` (${args[0]})` : ""}.`;
    case "SenderAlreadyDeclared": return "That sender is already declared.";
    case "DuplicateTransfer": return "This source transfer has already been verified and recorded.";
    case "ProofNotVerified": return "Attestcoin proof verification failed.";
    case "InsufficientPoolLiquidity": return "Loan pool does not have enough liquidity for this draw.";
    case "ZeroAmount": return "Amount must be greater than zero.";
    default: return `${name}()`;
  }
}

export function v1ErrorResponse(err: unknown, requestId: string): Response {
  const e = toV1Error(err);
  const body = { error: { code: e.code, message: e.message, details: e.details ?? {}, retryable: e.retryable, requestId } };
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Request-Id": requestId };
  if (e.code === "ATTESTATION_PENDING" && e.details?.retryAfterSeconds) headers["Retry-After"] = String(e.details.retryAfterSeconds);
  return new Response(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), { status: e.status, headers });
}

export function v1Json(data: unknown, status = 200, requestId: string, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId, ...extraHeaders },
  });
}
