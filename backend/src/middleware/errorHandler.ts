// backend/src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from "express";
import { AlreadyRecordedError } from "../../../worker/src/submitProof";

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/// Wraps an async route handler so thrown/rejected errors reach
/// errorHandler instead of crashing the process or hanging the request.
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof AlreadyRecordedError) {
    res.status(409).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";

  // Surface common on-chain custom errors with clearer status codes than a
  // blanket 500, since these are expected/user-facing outcomes, not bugs.
  const knownContractErrors = [
    "NotRegistered", "AlreadyRegistered", "ProofNotVerified", "TxHashMismatch",
    "SenderNotDeclared", "NotEligible", "CreditLimitExceeded", "ZeroAmount",
    "RepayExceedsOutstanding", "InsufficientPoolLiquidity", "DuplicateTransfer",
  ];
  const matched = knownContractErrors.find((name) => message.includes(name));
  if (matched) {
    res.status(400).json({ error: matched, message });
    return;
  }

  console.error("[backend] unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message });
}
