/**
 * Single source of truth for API documentation.
 * Every entry maps to a real route under /api/v1.
 * Do not document fields or behaviors that the handlers do not implement.
 */

export type HttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export type FieldType = "string" | "address" | "txHash" | "amount" | "number" | "boolean" | "json" | "string[]";

export type DocField = {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  example?: string;
  /** Where the value is sent */
  in: "body" | "query" | "path" | "header";
};

export type StatusDoc = {
  code: number;
  label: string;
  description: string;
};

export type EndpointDoc = {
  /** URL path under /docs/api/... */
  slug: string;
  method: HttpMethod;
  /** API path under /api/v1 */
  path: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  /** Requires Authorization: Bearer <session token> */
  auth: boolean;
  /** Operation may submit an on-chain transaction via the relayer */
  onChain: boolean;
  /** Needs wallet signature (SIWE) as part of the flow */
  needsSignature?: boolean;
  /** Destructive / funds-moving — show confirmation in tester */
  destructive?: boolean;
  whenToUse: string;
  whatHappens: string;
  fields: DocField[];
  headers: { name: string; required: boolean; description: string }[];
  statusCodes: StatusDoc[];
  exampleRequest?: Record<string, unknown> | null;
  exampleResponse: Record<string, unknown>;
  related: string[];
  notes?: string[];
};

export const CATEGORIES = [
  { id: "auth", label: "Authentication" },
  { id: "wallets", label: "Wallets" },
  { id: "senders", label: "Senders" },
  { id: "credit", label: "Credit" },
  { id: "loans", label: "Loans" },
  { id: "transfers", label: "Transfers" },
  { id: "activity", label: "Activity" },
  { id: "protocol", label: "Protocol" },
] as const;

const bearerHeader = {
  name: "Authorization",
  required: true,
  description: "Bearer <session_token> from POST /auth/verify",
};

const contentType = {
  name: "Content-Type",
  required: true,
  description: "application/json",
};

const idempotency = {
  name: "Idempotency-Key",
  required: false,
  description: "Optional unique key (≤128 chars). Replays return the original response for 24h.",
};

export const ENDPOINTS: EndpointDoc[] = [
  // ── Auth ─────────────────────────────────────────────────────────────
  {
    slug: "auth/challenge",
    method: "POST",
    path: "/auth/challenge",
    title: "Request SIWE challenge",
    summary: "Get a one-time SIWE message for a wallet to sign.",
    description:
      "Starts the authentication flow. The server generates a nonce (stored in Redis for 10 minutes), builds an EIP-4361 message bound to this API’s domain, URI, and Creditcoin chain ID, and returns it. The wallet must sign that exact message; the private key never leaves the user’s device.",
    category: "auth",
    auth: false,
    onChain: false,
    whenToUse: "Before any protected call. Call this whenever you need a fresh login.",
    whatHappens:
      "Server creates a nonce in Redis, returns the full SIWE message. No blockchain interaction.",
    fields: [
      {
        name: "address",
        type: "address",
        required: true,
        description: "Checksummed or lowercased EVM address that will sign the challenge.",
        example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        in: "body",
      },
    ],
    headers: [contentType],
    statusCodes: [
      { code: 200, label: "OK", description: "Challenge issued." },
      { code: 400, label: "Bad Request", description: "Invalid address or body." },
    ],
    exampleRequest: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" },
    exampleResponse: {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      nonce: "a1b2c3d4e5f6...",
      issuedAt: "2026-09-05T12:00:00.000Z",
      expirationTime: "2026-09-05T12:10:00.000Z",
      domain: "localhost",
      uri: "http://localhost",
      version: "1",
      chainId: 102031,
      statement: "Sign in to RemitCredit API...",
      message: "localhost wants you to sign in with your Ethereum account:\n0x742d...",
    },
    related: ["auth/verify", "auth/session"],
    notes: [
      "Nonce is single-use and expires after 10 minutes.",
      "Domain and URI are taken from API_SIWE_DOMAIN / API_SIWE_URI (or VERCEL_URL / localhost).",
    ],
  },
  {
    slug: "auth/verify",
    method: "POST",
    path: "/auth/verify",
    title: "Verify signature & create session",
    summary: "Exchange a signed SIWE message for a Bearer session token.",
    description:
      "Validates the signature, recovers the signer, checks domain/URI/chain ID, ensures the nonce exists and has not been used, then deletes the nonce and issues a session token (Redis, 24h TTL). Use the token as Authorization: Bearer <token> on protected routes.",
    category: "auth",
    auth: false,
    onChain: false,
    needsSignature: true,
    whenToUse: "Immediately after the user signs the challenge message in their wallet.",
    whatHappens:
      "Server verifies EIP-191 signature, consumes nonce, stores session in Redis, returns token.",
    fields: [
      {
        name: "message",
        type: "string",
        required: true,
        description: "Exact SIWE message string returned by /auth/challenge.",
        in: "body",
      },
      {
        name: "signature",
        type: "string",
        required: true,
        description: "Hex signature from personal_sign / eth_sign of the message.",
        example: "0x...",
        in: "body",
      },
    ],
    headers: [contentType],
    statusCodes: [
      { code: 200, label: "OK", description: "Session created." },
      { code: 400, label: "Bad Request", description: "Malformed message or body." },
      { code: 401, label: "Unauthorized", description: "Bad signature, expired/used nonce, domain/chain mismatch." },
    ],
    exampleRequest: {
      message: "localhost wants you to sign in with your Ethereum account:\n0x742d...",
      signature: "0xabc...",
    },
    exampleResponse: {
      token: "3f8a9c...",
      tokenType: "Bearer",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      issuedAt: "2026-09-05T12:01:00.000Z",
      expiresAt: "2026-09-06T12:01:00.000Z",
    },
    related: ["auth/challenge", "auth/session"],
    notes: ["Never send a private key or seed phrase. Only the signature is submitted."],
  },
  {
    slug: "auth/session",
    method: "GET",
    path: "/auth/session",
    title: "Get current session",
    summary: "Return the authenticated wallet address for the current Bearer token.",
    description: "Lightweight who-am-I check. Validates the session token against Redis.",
    category: "auth",
    auth: true,
    onChain: false,
    whenToUse: "To confirm a stored token is still valid before calling other endpoints.",
    whatHappens: "Looks up the session key in Redis and returns the bound address.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Session valid." },
      { code: 401, label: "Unauthorized", description: "Missing, invalid, or expired token." },
    ],
    exampleResponse: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", authenticated: true },
    related: ["auth/verify"],
  },
  {
    slug: "auth/session-revoke",
    method: "DELETE",
    path: "/auth/session",
    title: "Revoke session (logout)",
    summary: "Invalidate the current Bearer session token.",
    description: "Deletes the session from Redis. Subsequent requests with the same token return 401.",
    category: "auth",
    auth: true,
    onChain: false,
    whenToUse: "When the user logs out of your integration.",
    whatHappens: "Redis session key is deleted.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Session revoked." },
      { code: 401, label: "Unauthorized", description: "Missing or invalid token." },
    ],
    exampleResponse: { revoked: true },
    related: ["auth/session", "auth/challenge"],
  },

  // ── Wallets ──────────────────────────────────────────────────────────
  {
    slug: "wallets/me",
    method: "GET",
    path: "/wallets/me",
    title: "Get authenticated wallet profile",
    summary: "On-chain borrower record for the authenticated wallet.",
    description:
      "Reads RemittanceMicroLoan.getBorrower and availableCredit for the session’s address. Includes registration status, eligibility, credit limit, outstanding principal, risk score, and declared senders.",
    category: "wallets",
    auth: true,
    onChain: false,
    whenToUse: "Dashboard bootstrap or any time you need the full borrower snapshot.",
    whatHappens: "Live RPC reads against Creditcoin contracts (no write).",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Profile returned (registered may be false)." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 503, label: "Service Unavailable", description: "RPC/config missing." },
    ],
    exampleResponse: {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      registered: true,
      eligible: true,
      creditLimit: "1400000000",
      availableCredit: "800000000",
      outstandingPrincipal: "600000000",
      riskScoreBps: 1200,
      lastReviewedAt: 1757000000,
      declaredSenders: ["0x8ba1f109551bD432803012645Ac136ddd64DBA72"],
    },
    related: ["credit/limit", "senders", "loans"],
    notes: ["Amounts are integer strings in the loan token’s smallest units."],
  },

  // ── Senders ──────────────────────────────────────────────────────────
  {
    slug: "senders",
    method: "GET",
    path: "/senders",
    title: "List declared senders",
    summary: "List addresses declared as remittance senders for the authenticated borrower.",
    description:
      "Returns the on-chain declared-sender list from the micro-loan contract. Declaring a sender does not prove that wallet’s ownership—it only allows transfers from that address to count toward credit.",
    category: "senders",
    auth: true,
    onChain: false,
    whenToUse: "Onboarding UI and sender management screens.",
    whatHappens: "Contract view: getDeclaredSenders(borrower).",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "List (may be empty)." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      borrower: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      senders: [{ address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72", declared: true }],
    },
    related: ["senders/add", "senders/check", "senders/remove"],
  },
  {
    slug: "senders/add",
    method: "POST",
    path: "/senders",
    title: "Register borrower / add senders",
    summary: "Register the borrower (if needed) and declare one or more sender addresses.",
    description:
      "Two body shapes are supported: (1) { declaredSenders: string[] } registers the borrower with the first sender then adds the rest; (2) { address: string } adds a single sender for an already-registered borrower. The backend relayer submits onlyRelayer contract calls. Supports Idempotency-Key.",
    category: "senders",
    auth: true,
    onChain: true,
    destructive: false,
    whenToUse: "Onboarding and when adding a new family/partner wallet.",
    whatHappens:
      "Relayer calls registerBorrower and/or addDeclaredSender, waits for receipts, runs sender lifecycle hooks, appends activity.",
    fields: [
      {
        name: "declaredSenders",
        type: "string[]",
        required: false,
        description: "One or more sender addresses (use this shape for register/bulk).",
        example: '["0x8ba1f109551bD432803012645Ac136ddd64DBA72"]',
        in: "body",
      },
      {
        name: "address",
        type: "address",
        required: false,
        description: "Single sender to add (alternative body shape).",
        example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
        in: "body",
      },
    ],
    headers: [contentType, bearerHeader, idempotency],
    statusCodes: [
      { code: 201, label: "Created", description: "On-chain register/add confirmed." },
      { code: 400, label: "Bad Request", description: "Invalid body." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 409, label: "Conflict", description: "Already registered or sender already declared." },
      { code: 503, label: "Service Unavailable", description: "Relayer not configured." },
    ],
    exampleRequest: {
      declaredSenders: ["0x8ba1f109551bD432803012645Ac136ddd64DBA72"],
    },
    exampleResponse: {
      borrower: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      declaredSenders: ["0x8ba1f109551bD432803012645Ac136ddd64DBA72"],
      newlyDeclared: ["0x8ba1f109551bD432803012645Ac136ddd64DBA72"],
      txHashes: ["0xabc..."],
      status: "confirmed",
    },
    related: ["senders", "senders/remove", "wallets/me"],
    notes: [
      "Provide either declaredSenders or address—not both required together.",
      "Relayer pays gas; user does not sign a contract transaction.",
    ],
  },
  {
    slug: "senders/check",
    method: "GET",
    path: "/senders/{address}",
    title: "Check if sender is declared",
    summary: "Return whether a given address is a declared sender for the authenticated borrower.",
    description: "Path parameter is the sender address. Uses isDeclaredSender on the micro-loan contract.",
    category: "senders",
    auth: true,
    onChain: false,
    whenToUse: "Validate a sender before showing UI state.",
    whatHappens: "Contract view call.",
    fields: [
      {
        name: "address",
        type: "address",
        required: true,
        description: "Sender address to check.",
        example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
        in: "path",
      },
    ],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "declared true or false." },
      { code: 400, label: "Bad Request", description: "Invalid path address." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      borrower: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      sender: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      declared: true,
    },
    related: ["senders", "senders/remove"],
  },
  {
    slug: "senders/remove",
    method: "DELETE",
    path: "/senders/{address}",
    title: "Remove declared sender",
    summary: "Remove a sender from the borrower’s on-chain declared list.",
    description:
      "Relayer calls removeDeclaredSender. Path parameter is the sender address. Supports Idempotency-Key.",
    category: "senders",
    auth: true,
    onChain: true,
    whenToUse: "When a support source should no longer count toward credit.",
    whatHappens: "Relayer transaction; waits for confirmation.",
    fields: [
      {
        name: "address",
        type: "address",
        required: true,
        description: "Sender to remove.",
        example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
        in: "path",
      },
    ],
    headers: [bearerHeader, idempotency],
    statusCodes: [
      { code: 200, label: "OK", description: "Removed on-chain." },
      { code: 400, label: "Bad Request", description: "Invalid address." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 404, label: "Not Found", description: "SenderNotFound contract error." },
    ],
    exampleResponse: {
      borrower: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      sender: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      txHash: "0xdef...",
      status: "confirmed",
    },
    related: ["senders", "senders/add"],
  },

  // ── Credit ───────────────────────────────────────────────────────────
  {
    slug: "credit/limit",
    method: "GET",
    path: "/credit/limit",
    title: "Get credit limit",
    summary: "Credit limit, available credit, and eligibility for the authenticated wallet.",
    description: "Aggregates on-chain borrower fields and availableCredit into a credit-focused response.",
    category: "credit",
    auth: true,
    onChain: false,
    whenToUse: "Before requesting a loan draw.",
    whatHappens: "Contract reads only.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Limit data." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      creditLimit: "1400000000",
      availableCredit: "800000000",
      outstandingPrincipal: "600000000",
      eligible: true,
      riskScoreBps: 1200,
      lastReviewedAt: 1757000000,
      registered: true,
    },
    related: ["credit/available", "credit/rationale", "loans/request"],
  },
  {
    slug: "credit/available",
    method: "GET",
    path: "/credit/available",
    title: "Get available credit",
    summary: "How much can still be drawn against the line.",
    description: "Subset of credit limit focused on availableCredit = limit − outstanding (enforced on-chain).",
    category: "credit",
    auth: true,
    onChain: false,
    whenToUse: "Validate a proposed draw amount client-side before POST /loans.",
    whatHappens: "Contract reads.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Available amount." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      availableCredit: "800000000",
      creditLimit: "1400000000",
      outstandingPrincipal: "600000000",
    },
    related: ["credit/limit", "loans/request"],
  },
  {
    slug: "credit/risk-score",
    method: "GET",
    path: "/credit/risk-score",
    title: "Get risk score",
    summary: "On-chain risk score in basis points (0–10000 scale).",
    description: "Returns riskScoreBps from the borrower record. Scale is basis points; higher values indicate higher assessed risk in the decision engine’s encoding.",
    category: "credit",
    auth: true,
    onChain: false,
    whenToUse: "Display risk classification in your product UI.",
    whatHappens: "Contract read.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Score." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      riskScoreBps: 1200,
      scale: "basis_points",
      max: 10000,
      eligible: true,
    },
    related: ["credit/rationale", "credit/limit"],
  },
  {
    slug: "credit/rationale",
    method: "GET",
    path: "/credit/rationale",
    title: "Get credit rationale",
    summary: "Stats, decision preview, and human-readable rationale from the rules engine.",
    description:
      "Loads remittance stats from the registry, runs decideCreditLine / explainDecision (same logic as the DApp preview), and returns stats, decision, rationale text, and parameter thresholds. Does not write on-chain by itself.",
    category: "credit",
    auth: true,
    onChain: false,
    whenToUse: "Explain to users why a limit was set; power underwriting transparency UIs.",
    whatHappens: "Registry getStats + off-chain creditAgent decision helpers.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Rationale payload." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      stats: {
        transferCount: 3,
        totalAmount: "1150000000",
        consistencyBps: 9200,
        lastTransferAt: 1757000000,
      },
      decision: { eligible: true, creditLimit: "1400000000", riskScoreBps: 1200 },
      rationale: "Eligible: transfer count and inflow meet minimums...",
    },
    related: ["credit/review", "credit/profile", "transfers/stats"],
  },
  {
    slug: "credit/profile",
    method: "GET",
    path: "/credit/profile",
    title: "Get full credit profile",
    summary: "Combined credit limit fields plus rationale/stats.",
    description: "Convenience endpoint merging getCreditLimit and getCreditRationale.",
    category: "credit",
    auth: true,
    onChain: false,
    whenToUse: "Single round-trip for a full credit screen.",
    whatHappens: "Parallel service calls; still read-only.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Merged profile." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      creditLimit: "1400000000",
      availableCredit: "800000000",
      eligible: true,
      riskScoreBps: 1200,
      stats: { transferCount: 3, totalAmount: "1150000000" },
      rationale: "Eligible: ...",
    },
    related: ["credit/limit", "credit/rationale"],
  },
  {
    slug: "credit/review",
    method: "POST",
    path: "/credit/review",
    title: "Request on-chain credit review",
    summary: "Ask the protocol to recompute and store the borrower’s credit decision on-chain.",
    description:
      "Relayer submits requestCreditReview(borrower). After confirmation, returns updated eligible, creditLimit, riskScoreBps, and txHash. Supports Idempotency-Key.",
    category: "credit",
    auth: true,
    onChain: true,
    whenToUse: "After new remittances are proven and you want the on-chain limit refreshed.",
    whatHappens: "Relayer tx → CreditDecisionEngine path on-chain → activity event.",
    fields: [],
    headers: [bearerHeader, idempotency],
    statusCodes: [
      { code: 200, label: "OK", description: "Review confirmed." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 404, label: "Not Found", description: "Borrower not registered." },
      { code: 503, label: "Service Unavailable", description: "Relayer missing." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      eligible: true,
      creditLimit: "1400000000",
      riskScoreBps: 1200,
      lastReviewedAt: 1757000100,
      txHash: "0xreview...",
      status: "confirmed",
    },
    related: ["credit/rationale", "transfers/verify"],
    notes: ["Requires the borrower to already be registered."],
  },

  // ── Loans ────────────────────────────────────────────────────────────
  {
    slug: "loans",
    method: "GET",
    path: "/loans",
    title: "Get loan position",
    summary: "Current revolving outstanding principal and available credit.",
    description:
      "The protocol does not issue discrete loan IDs. Each borrower has a single outstandingPrincipal. This endpoint returns that position plus limits.",
    category: "loans",
    auth: true,
    onChain: false,
    whenToUse: "Loan dashboard / repay screen.",
    whatHappens: "Contract reads.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Position." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      registered: true,
      creditLimit: "1400000000",
      outstandingPrincipal: "600000000",
      availableCredit: "800000000",
      model: "revolving_principal",
    },
    related: ["loans/request", "loans/repay", "credit/available"],
  },
  {
    slug: "loans/request",
    method: "POST",
    path: "/loans",
    title: "Request loan draw",
    summary: "Draw stablecoin against available credit.",
    description:
      "Validates registration, eligibility, and available credit, then the relayer calls requestLoan(borrower, amount). Amount is the raw token integer string. Supports Idempotency-Key. Response includes txHash after confirmation.",
    category: "loans",
    auth: true,
    onChain: true,
    destructive: true,
    whenToUse: "When the borrower needs working capital within their line.",
    whatHappens:
      "API checks available credit → relayer requestLoan → wait receipt → update activity.",
    fields: [
      {
        name: "amount",
        type: "amount",
        required: true,
        description: "Draw amount in loan-token smallest units (integer decimal string).",
        example: "600000000",
        in: "body",
      },
    ],
    headers: [contentType, bearerHeader, idempotency],
    statusCodes: [
      { code: 201, label: "Created", description: "Draw confirmed on-chain." },
      { code: 400, label: "Bad Request", description: "Invalid amount." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 403, label: "Forbidden", description: "Not eligible." },
      { code: 404, label: "Not Found", description: "Not registered." },
      { code: 422, label: "Unprocessable", description: "INSUFFICIENT_CREDIT or contract CreditLimitExceeded." },
      { code: 503, label: "Service Unavailable", description: "Pool liquidity or relayer issue." },
    ],
    exampleRequest: { amount: "600000000" },
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      amount: "600000000",
      outstandingPrincipal: "600000000",
      availableCredit: "800000000",
      txHash: "0xloan...",
      status: "confirmed",
    },
    related: ["loans", "loans/repay", "credit/available"],
    notes: [
      "⚠ This submits an on-chain transaction via the backend relayer.",
      "Amount must not exceed availableCredit.",
    ],
  },
  {
    slug: "loans/repay",
    method: "POST",
    path: "/loans/repay",
    title: "Repay outstanding principal",
    summary: "Repay part or all of the revolving balance.",
    description:
      "Checks outstanding principal and ERC-20 allowance from the borrower to the micro-loan contract. If allowance is insufficient, returns INSUFFICIENT_ALLOWANCE—the borrower must approve from their own wallet first. Then the relayer calls repay. Supports Idempotency-Key.",
    category: "loans",
    auth: true,
    onChain: true,
    destructive: true,
    whenToUse: "After the borrower has approved the loan token and wants to reduce outstanding.",
    whatHappens:
      "Allowance check → relayer repay → wait receipt → activity. Partial repayments are allowed if amount ≤ outstanding.",
    fields: [
      {
        name: "amount",
        type: "amount",
        required: true,
        description: "Repay amount in loan-token smallest units.",
        example: "600000000",
        in: "body",
      },
    ],
    headers: [contentType, bearerHeader, idempotency],
    statusCodes: [
      { code: 200, label: "OK", description: "Repay confirmed." },
      { code: 400, label: "Bad Request", description: "INSUFFICIENT_ALLOWANCE or invalid amount." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 404, label: "Not Found", description: "Not registered." },
      { code: 422, label: "Unprocessable", description: "REPAY_EXCEEDS_OUTSTANDING." },
    ],
    exampleRequest: { amount: "600000000" },
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      amount: "600000000",
      outstandingPrincipal: "0",
      availableCredit: "1400000000",
      txHash: "0xrepay...",
      status: "confirmed",
    },
    related: ["loans", "loans/request"],
    notes: [
      "⚠ On-chain. Borrower must approve the loan token to the micro-loan contract before calling this API.",
      "API never holds user private keys.",
    ],
  },

  // ── Transfers ────────────────────────────────────────────────────────
  {
    slug: "transfers",
    method: "GET",
    path: "/transfers",
    title: "List proven remittances",
    summary: "Attestcoin-verified transfers recorded for the authenticated borrower.",
    description: "Reads the credit registry’s transfer list. Only transfers that passed Attestcoin verification appear here.",
    category: "transfers",
    auth: true,
    onChain: false,
    whenToUse: "Remittance history UI.",
    whatHappens: "Registry getTransfers.",
    fields: [],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Transfers array." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      transfers: [
        {
          sourceTxHash: "0xsrc...",
          sender: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
          recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          amount: "450000000",
          sourceTimestamp: 1756900000,
          recordedAt: 1756900100,
          verificationState: "proven",
        },
      ],
    },
    related: ["transfers/stats", "transfers/verify"],
  },
  {
    slug: "transfers/stats",
    method: "GET",
    path: "/transfers/stats",
    title: "Remittance statistics",
    summary: "Aggregated stats over a lookback window.",
    description:
      "Calls registry getStats(borrower, lookbackWindowSeconds). Optional query window (seconds); default is the protocol lookback used by the credit agent (~180 days).",
    category: "transfers",
    auth: true,
    onChain: false,
    whenToUse: "Charts and credit rationale inputs.",
    whatHappens: "Contract view.",
    fields: [
      {
        name: "window",
        type: "number",
        required: false,
        description: "Lookback window in seconds.",
        example: "15552000",
        in: "query",
      },
    ],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Stats." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      windowSeconds: 15552000,
      stats: {
        transferCount: 3,
        totalAmount: "1150000000",
        firstTimestamp: 1756000000,
        lastTimestamp: 1757000000,
        avgIntervalSeconds: 86400,
        consistencyBps: 9200,
      },
    },
    related: ["transfers", "credit/rationale"],
  },
  {
    slug: "transfers/verify",
    method: "POST",
    path: "/transfers/verify",
    title: "Manually verify a transfer",
    summary: "Submit an Attestcoin proof for a source-chain remittance tx hash.",
    description:
      "Builds and submits a cross-chain proof for sourceTxHash via the worker path (WORKER_PRIVATE_KEY). Rejects duplicates already recorded. Optional borrower defaults to the authenticated wallet and must match it. Supports Idempotency-Key.",
    category: "transfers",
    auth: true,
    onChain: true,
    destructive: true,
    whenToUse: "When automatic indexing has not yet picked up a transfer the user knows exists.",
    whatHappens:
      "Proof service → submitRemittanceProof on Creditcoin → registry record → activity.",
    fields: [
      {
        name: "txHash",
        type: "txHash",
        required: true,
        description: "Source-chain transaction hash (32-byte hex).",
        example: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
        in: "body",
      },
      {
        name: "borrower",
        type: "address",
        required: false,
        description: "Defaults to authenticated wallet; must equal session address if set.",
        in: "body",
      },
    ],
    headers: [contentType, bearerHeader, idempotency],
    statusCodes: [
      { code: 201, label: "Created", description: "Proof submitted and confirmed." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
      { code: 403, label: "Forbidden", description: "borrower ≠ session wallet." },
      { code: 409, label: "Conflict", description: "Already recorded." },
      { code: 425, label: "Too Early", description: "Attestation pending—retry later." },
      { code: 503, label: "Service Unavailable", description: "Worker/proof module unavailable." },
    ],
    exampleRequest: {
      txHash: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
    },
    exampleResponse: {
      verified: true,
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      sourceTxHash: "0x1111...",
      amount: "450000000",
      onchainTxHash: "0xproof...",
      status: "confirmed",
      checks: { notAlreadyRecorded: true, proofSubmitted: true, onchainConfirmed: true },
    },
    related: ["transfers", "credit/review"],
    notes: [
      "⚠ Submits an on-chain Attestcoin verification transaction.",
      "Requires WORKER_PRIVATE_KEY and proof submission module in the deployment.",
    ],
  },

  // ── Activity ─────────────────────────────────────────────────────────
  {
    slug: "activity",
    method: "GET",
    path: "/activity",
    title: "Activity feed",
    summary: "Recent events for the authenticated borrower from Redis.",
    description:
      "Returns activity events (registration, verification, credit review, loan disbursed/repaid) stored in Redis—not a full chain indexer. Optional limit query (1–100, default 50).",
    category: "activity",
    auth: true,
    onChain: false,
    whenToUse: "In-app activity timeline.",
    whatHappens: "Redis list read for the borrower key.",
    fields: [
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Max events (1–100).",
        example: "20",
        in: "query",
      },
    ],
    headers: [bearerHeader],
    statusCodes: [
      { code: 200, label: "OK", description: "Events array." },
      { code: 401, label: "Unauthorized", description: "Invalid session." },
    ],
    exampleResponse: {
      events: [
        {
          id: "evt_12",
          borrower: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          type: "loan_disbursed",
          data: { amount: "600000000", txHash: "0x..." },
          timestamp: 1757000200,
        },
      ],
    },
    related: ["loans", "transfers"],
  },

  // ── Protocol ─────────────────────────────────────────────────────────
  {
    slug: "protocol",
    method: "GET",
    path: "/protocol",
    title: "Protocol configuration",
    summary: "Public network, contract addresses, and operational notes.",
    description:
      "No authentication. Returns networkEnv, chain IDs, contract addresses, USC precompile, relayer address when available, and loan token decimals. Useful for clients configuring RPC and approvals.",
    category: "protocol",
    auth: false,
    onChain: false,
    whenToUse: "App bootstrap and tooling.",
    whatHappens: "Config + optional RPC reads for relayer/decimals.",
    fields: [],
    headers: [],
    statusCodes: [{ code: 200, label: "OK", description: "Config object." }],
    exampleResponse: {
      networkEnv: "testnet",
      creditcoin: { chainId: 102031, rpcUrlConfigured: true },
      contracts: {
        remittanceMicroLoan: "0x...",
        creditRegistry: "0x...",
        creditDecisionEngine: "0x...",
        loanStablecoin: "0x...",
      },
      loanTokenDecimals: 6,
    },
    related: ["openapi"],
  },
  {
    slug: "openapi",
    method: "GET",
    path: "/openapi",
    title: "OpenAPI specification",
    summary: "Machine-readable OpenAPI 3.1 document for this API.",
    description: "JSON OpenAPI document describing paths, security, and schemas.",
    category: "protocol",
    auth: false,
    onChain: false,
    whenToUse: "Codegen, Postman import, or Scalar/Swagger UI.",
    whatHappens: "Static spec response.",
    fields: [],
    headers: [],
    statusCodes: [{ code: 200, label: "OK", description: "OpenAPI JSON." }],
    exampleResponse: { openapi: "3.1.0", info: { title: "RemitCredit API", version: "1.0.0" } },
    related: ["protocol"],
  },
];

export function getEndpoint(slug: string): EndpointDoc | undefined {
  return ENDPOINTS.find((e) => e.slug === slug);
}

export function endpointsByCategory(): { category: (typeof CATEGORIES)[number]; items: EndpointDoc[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: ENDPOINTS.filter((e) => e.category === category.id),
  })).filter((g) => g.items.length > 0);
}

export function searchEndpoints(q: string): EndpointDoc[] {
  const s = q.trim().toLowerCase();
  if (!s) return ENDPOINTS;
  return ENDPOINTS.filter(
    (e) =>
      e.slug.includes(s) ||
      e.path.toLowerCase().includes(s) ||
      e.title.toLowerCase().includes(s) ||
      e.summary.toLowerCase().includes(s) ||
      e.method.toLowerCase() === s
  );
}

export const API_BASE = "/api/v1";
