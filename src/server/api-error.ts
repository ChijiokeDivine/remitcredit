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

const KNOWN_CONTRACT_ERRORS = [
  "NotRegistered",
  "AlreadyRegistered",
  "ProofNotVerified",
  "TxHashMismatch",
  "SenderNotDeclared",
  "NotEligible",
  "CreditLimitExceeded",
  "ZeroAmount",
  "RepayExceedsOutstanding",
  "InsufficientPoolLiquidity",
  "DuplicateTransfer",
];

/** Map any thrown value to a Next Response. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: err.message, details: err.details }, err.statusCode);
  }

  const message = err instanceof Error ? err.message : "Unknown error";

  if (message.includes("AlreadyRecorded") || message.includes("already recorded")) {
    return json({ error: message }, 409);
  }

  const matched = KNOWN_CONTRACT_ERRORS.find((name) => message.includes(name));
  if (matched) {
    return json({ error: matched, message }, 400);
  }

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
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
