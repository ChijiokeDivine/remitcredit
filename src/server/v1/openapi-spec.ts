export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "RemitCredit API",
    version: "1.0.0",
    description:
      "Programmable access to RemitCredit. SIWE wallet auth only. Authoritative state is on-chain; sessions/nonces/idempotency/activity in Redis. No application database.",
  },
  servers: [{ url: "/api/v1", description: "Version 1" }],
  tags: [
    { name: "Auth" }, { name: "Wallets" }, { name: "Senders" }, { name: "Credit" },
    { name: "Loans" }, { name: "Transfers" }, { name: "Activity" }, { name: "Protocol" },
  ],
  components: {
    securitySchemes: {
      BearerSession: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "SessionToken",
        description: "Session token from POST /auth/verify (SIWE).",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" },
              retryable: { type: "boolean" },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        schema: { type: "string", maxLength: 128 },
      },
    },
  },
  paths: {
    "/auth/challenge": {
      post: {
        tags: ["Auth"],
        summary: "Request SIWE challenge",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["address"],
                properties: { address: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Challenge issued" }, "400": { description: "Invalid" } },
      },
    },
    "/auth/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify SIWE signature and create session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "signature"],
                properties: { message: { type: "string" }, signature: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Session" }, "401": { description: "Unauthorized" } },
      },
    },
    "/auth/session": {
      get: { tags: ["Auth"], summary: "Current session", security: [{ BearerSession: [] }], responses: { "200": { description: "OK" } } },
      delete: { tags: ["Auth"], summary: "Revoke session", security: [{ BearerSession: [] }], responses: { "200": { description: "Revoked" } } },
    },
    "/wallets/me": {
      get: { tags: ["Wallets"], summary: "Wallet profile", security: [{ BearerSession: [] }], responses: { "200": { description: "Profile" } } },
    },
    "/senders": {
      get: { tags: ["Senders"], summary: "List declared senders", security: [{ BearerSession: [] }], responses: { "200": { description: "List" } } },
      post: {
        tags: ["Senders"],
        summary: "Register / add senders",
        security: [{ BearerSession: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/senders/{address}": {
      get: {
        tags: ["Senders"],
        summary: "Check sender",
        security: [{ BearerSession: [] }],
        parameters: [{ name: "address", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Status" } },
      },
      delete: {
        tags: ["Senders"],
        summary: "Remove sender",
        security: [{ BearerSession: [] }],
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string" } },
          { $ref: "#/components/parameters/IdempotencyKey" },
        ],
        responses: { "200": { description: "Removed" } },
      },
    },
    "/credit/limit": { get: { tags: ["Credit"], summary: "Credit limit", security: [{ BearerSession: [] }], responses: { "200": { description: "Limit" } } } },
    "/credit/available": { get: { tags: ["Credit"], summary: "Available credit", security: [{ BearerSession: [] }], responses: { "200": { description: "Available" } } } },
    "/credit/risk-score": { get: { tags: ["Credit"], summary: "Risk score", security: [{ BearerSession: [] }], responses: { "200": { description: "Score" } } } },
    "/credit/rationale": { get: { tags: ["Credit"], summary: "Rationale", security: [{ BearerSession: [] }], responses: { "200": { description: "Rationale" } } } },
    "/credit/profile": { get: { tags: ["Credit"], summary: "Full profile", security: [{ BearerSession: [] }], responses: { "200": { description: "Profile" } } } },
    "/credit/review": {
      post: {
        tags: ["Credit"],
        summary: "Request credit review",
        security: [{ BearerSession: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        responses: { "200": { description: "Reviewed" } },
      },
    },
    "/loans": {
      get: { tags: ["Loans"], summary: "Loan position", security: [{ BearerSession: [] }], responses: { "200": { description: "Status" } } },
      post: {
        tags: ["Loans"],
        summary: "Request loan draw",
        security: [{ BearerSession: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: { amount: { type: "string", description: "Raw token units" } },
              },
            },
          },
        },
        responses: { "201": { description: "Disbursed" }, "422": { description: "Insufficient credit" } },
      },
    },
    "/loans/repay": {
      post: {
        tags: ["Loans"],
        summary: "Repay principal",
        security: [{ BearerSession: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: { amount: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Repaid" } },
      },
    },
    "/transfers": { get: { tags: ["Transfers"], summary: "List proven transfers", security: [{ BearerSession: [] }], responses: { "200": { description: "Transfers" } } } },
    "/transfers/stats": {
      get: {
        tags: ["Transfers"],
        summary: "Transfer stats",
        security: [{ BearerSession: [] }],
        parameters: [{ name: "window", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Stats" } },
      },
    },
    "/transfers/verify": {
      post: {
        tags: ["Transfers"],
        summary: "Manually verify transfer (Attestcoin)",
        security: [{ BearerSession: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["txHash"],
                properties: { txHash: { type: "string" }, borrower: { type: "string" } },
              },
            },
          },
        },
        responses: { "201": { description: "Verified" }, "409": { description: "Duplicate" } },
      },
    },
    "/activity": {
      get: {
        tags: ["Activity"],
        summary: "Activity feed",
        security: [{ BearerSession: [] }],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Events" } },
      },
    },
    "/protocol": { get: { tags: ["Protocol"], summary: "Protocol config", responses: { "200": { description: "Config" } } } },
    "/openapi": { get: { tags: ["Protocol"], summary: "OpenAPI document", responses: { "200": { description: "Spec" } } } },
  },
} as const;
