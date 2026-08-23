// Same-origin Next Route Handlers under /api/*
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let body: unknown;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : res.statusText || "Request failed";
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

export type BorrowerRecord = {
  registered: boolean;
  eligible: boolean;
  creditLimit: string;
  outstandingPrincipal: string;
  riskScoreBps: number;
  lastReviewedAt: number;
  declaredSenders?: string[];
};

export type CreditDecision = {
  borrower: string;
  registered?: boolean;
  eligible: boolean;
  creditLimit: string;
  riskScoreBps: number;
  lastReviewedAt?: number;
};

export type CreditPreview = {
  borrower: string;
  stats: {
    transferCount: number;
    totalAmount: string;
    avgIntervalSeconds: number;
    lastTransferAt: number;
    consistencyBps: number;
  };
  decision: {
    eligible: boolean;
    creditLimit: string;
    riskScoreBps: number;
  };
  rationale: string;
};

export type LoanStatus = {
  borrower: string;
  registered?: boolean;
  creditLimit: string;
  outstandingPrincipal: string;
  availableCredit: string;
};

export type VerifiedTransfer = {
  sourceTxHash: string;
  amount: string;
  sender: string;
  timestamp: number;
  blockNumber?: number;
};

export type ActivityEvent = {
  id?: string;
  borrower: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
};

export function getBorrower(address: string) {
  return request<BorrowerRecord>(`/borrowers/${address}`);
}
export function getDeclaredSenders(address: string) {
  return request<{ borrower: string; declaredSenders: string[] }>(
    `/borrowers/${address}/senders`
  );
}
export function registerBorrower(borrower: string, declaredSenders: string[]) {
  return request<{ borrower: string; declaredSenders: string[]; txHash: string }>(
    "/borrowers",
    { method: "POST", body: JSON.stringify({ borrower, declaredSenders }) }
  );
}
export function addDeclaredSender(borrower: string, sender: string) {
  return request<{ borrower: string; sender: string; txHash: string }>(
    "/borrowers/senders",
    { method: "POST", body: JSON.stringify({ borrower, sender }) }
  );
}
export function removeDeclaredSender(borrower: string, sender: string) {
  return request<{ borrower: string; sender: string; txHash: string }>(
    "/borrowers/senders",
    { method: "DELETE", body: JSON.stringify({ borrower, sender }) }
  );
}
export function getBorrowerActivity(address: string) {
  return request<{ events: ActivityEvent[] }>(`/borrowers/${address}/activity`);
}
export function getRemittances(borrower: string) {
  return request<{ borrower: string; transfers: VerifiedTransfer[] }>(
    `/remittances/${borrower}`
  );
}
export function getRemittanceStats(borrower: string, windowSeconds?: number) {
  const q = windowSeconds ? `?window=${windowSeconds}` : "";
  return request<{
    borrower: string;
    windowSeconds: number;
    stats: CreditPreview["stats"];
  }>(`/remittances/${borrower}/stats${q}`);
}
export function verifyRemittance(borrower: string, sourceTxHash: string) {
  return request<{ onchainTxHash: string; amount: string; sourceTxHash: string }>(
    "/remittances/verify",
    { method: "POST", body: JSON.stringify({ borrower, sourceTxHash }) }
  );
}
export function getCredit(borrower: string) {
  return request<CreditDecision>(`/credit/${borrower}`);
}
export function getCreditPreview(borrower: string) {
  return request<CreditPreview>(`/credit/${borrower}/preview`);
}
export function requestCreditReview(borrower: string) {
  return request<CreditDecision & { txHash: string }>(`/credit/${borrower}/review`, {
    method: "POST",
  });
}
export function getLoan(borrower: string) {
  return request<LoanStatus>(`/loans/${borrower}`);
}
export function requestLoan(borrower: string, amount: string) {
  return request<{
    borrower: string;
    amount: string;
    newOutstanding: string;
    txHash: string;
  }>("/loans/request", {
    method: "POST",
    body: JSON.stringify({ borrower, amount }),
  });
}
export function repayLoan(borrower: string, amount: string) {
  return request<{
    borrower: string;
    amount: string;
    newOutstanding: string;
    txHash: string;
  }>("/loans/repay", {
    method: "POST",
    body: JSON.stringify({ borrower, amount }),
  });
}
export function getActivity(limit?: number) {
  const q = limit ? `?limit=${limit}` : "";
  return request<{ events: ActivityEvent[] }>(`/activity${q}`);
}
export function getHealth() {
  return request<{ status: string; networkEnv: string }>("/health");
}

