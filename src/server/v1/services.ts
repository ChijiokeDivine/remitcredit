// src/server/v1/services.ts — reuses RemitCreditClient, creditAgent, activityStore
import { getAddress } from "ethers";
import { getReadClient, requireRelayerClient } from "../contracts";
import { activityStore } from "../store";
import { getConfig } from "../config";
import { decideCreditLine, explainDecision } from "../../../shared/services/creditAgent";
import { handleSenderDeclared } from "../../../shared/services/senderLifecycle";
import { RemitCreditClient } from "../../../shared/services/contractClient";
import { V1Error } from "./errors";

const DEFAULT_LOOKBACK = 180 * 24 * 60 * 60;

export async function getWalletProfile(address: string) {
  const client = getReadClient();
  const borrower = await client.getBorrower(address);
  const available = await client.getAvailableCredit(address);
  return {
    address: getAddress(address),
    registered: borrower.registered,
    eligible: borrower.eligible,
    creditLimit: borrower.creditLimit,
    availableCredit: available,
    outstandingPrincipal: borrower.outstandingPrincipal,
    riskScoreBps: borrower.riskScoreBps,
    lastReviewedAt: borrower.lastReviewedAt,
    declaredSenders: borrower.declaredSenders.map((a) => getAddress(a)),
  };
}

export async function listSenders(borrower: string) {
  const senders = await getReadClient().getDeclaredSenders(borrower);
  return {
    borrower: getAddress(borrower),
    senders: senders.map((a) => ({ address: getAddress(a), declared: true })),
  };
}

export async function isSenderDeclared(borrower: string, sender: string) {
  const declared = await getReadClient().isDeclaredSender(borrower, sender);
  return { borrower: getAddress(borrower), sender: getAddress(sender), declared };
}

export async function registerOrAddSenders(borrower: string, declaredSenders: string[]) {
  const existing = await getReadClient().getBorrower(borrower);
  const already = new Set(existing.declaredSenders.map((a) => a.toLowerCase()));
  const client = requireRelayerClient();
  const txHashes: string[] = [];
  let toAdd = declaredSenders;
  const newlyDeclared: string[] = [];

  if (!existing.registered) {
    const [first, ...rest] = declaredSenders;
    const tx = await client.registerBorrower(borrower, first);
    const receipt = await tx.wait();
    txHashes.push(receipt?.hash ?? tx.hash);
    already.add(first.toLowerCase());
    newlyDeclared.push(first);
    toAdd = rest;
  }
  for (const sender of toAdd) {
    if (already.has(sender.toLowerCase())) continue;
    const tx = await client.addDeclaredSender(borrower, sender);
    const receipt = await tx.wait();
    txHashes.push(receipt?.hash ?? tx.hash);
    newlyDeclared.push(sender);
  }
  for (const sender of newlyDeclared) {
    try {
      await handleSenderDeclared(sender, borrower);
    } catch (err) {
      console.error(`[v1] sender lifecycle failed sender=${sender}:`, err);
    }
  }
  await activityStore.append({
    borrower,
    type: "borrower_registered",
    data: {
      declaredSenders,
      txHash: txHashes[0] ?? null,
      txHashes,
      alreadyRegistered: existing.registered,
      newlyDeclared,
    },
  });
  return {
    borrower: getAddress(borrower),
    declaredSenders: declaredSenders.map((a) => getAddress(a)),
    newlyDeclared: newlyDeclared.map((a) => getAddress(a)),
    txHashes,
    status: txHashes.length ? "confirmed" : "noop",
  };
}

export async function addSender(borrower: string, sender: string) {
  const existing = await getReadClient().getBorrower(borrower);
  if (!existing.registered) {
    throw new V1Error("NOT_REGISTERED", "Borrower is not registered. Register with at least one sender first.", 404);
  }
  if (existing.declaredSenders.some((a) => a.toLowerCase() === sender.toLowerCase())) {
    throw new V1Error("SENDER_ALREADY_DECLARED", "That sender is already declared.", 409);
  }
  const client = requireRelayerClient();
  const tx = await client.addDeclaredSender(borrower, sender);
  const receipt = await tx.wait();
  try {
    await handleSenderDeclared(sender, borrower);
  } catch (err) {
    console.error(`[v1] sender lifecycle failed:`, err);
  }
  return {
    borrower: getAddress(borrower),
    sender: getAddress(sender),
    txHash: receipt?.hash ?? tx.hash,
    status: "confirmed" as const,
  };
}

export async function removeSender(borrower: string, sender: string) {
  const client = requireRelayerClient();
  const tx = await client.removeDeclaredSender(borrower, sender);
  const receipt = await tx.wait();
  return {
    borrower: getAddress(borrower),
    sender: getAddress(sender),
    txHash: receipt?.hash ?? tx.hash,
    status: "confirmed" as const,
  };
}

export async function getCreditLimit(borrower: string) {
  const profile = await getWalletProfile(borrower);
  return {
    wallet: profile.address,
    creditLimit: profile.creditLimit,
    availableCredit: profile.availableCredit,
    outstandingPrincipal: profile.outstandingPrincipal,
    eligible: profile.eligible,
    riskScoreBps: profile.riskScoreBps,
    lastReviewedAt: profile.lastReviewedAt,
    asset: "loan stablecoin (see /protocol)",
    registered: profile.registered,
  };
}

export async function getCreditRationale(borrower: string) {
  const params = {
    minTransferCount: 3,
    minTotalAmount: BigInt("300000000"),
    minConsistencyBps: 5000,
    creditMultiplierBps: 3000,
    maxCreditLimit: BigInt("1000000000"),
    lookbackWindowSeconds: DEFAULT_LOOKBACK,
    maxStalenessSeconds: 60 * 24 * 60 * 60,
  };
  const rawStats = await getReadClient().getStats(borrower, params.lookbackWindowSeconds);
  const decision = decideCreditLine(rawStats, params);
  const rationale = explainDecision(rawStats, decision);
  return {
    wallet: getAddress(borrower),
    stats: {
      transferCount: rawStats.transferCount,
      totalAmount: rawStats.totalAmount,
      avgIntervalSeconds: rawStats.avgIntervalSeconds,
      lastTransferAt: rawStats.lastTimestamp,
      firstTransferAt: rawStats.firstTimestamp,
      consistencyBps: rawStats.intervalConsistencyBps,
    },
    decision: {
      eligible: decision.eligible,
      creditLimit: decision.creditLimit,
      riskScoreBps: decision.riskScoreBps,
    },
    rationale,
    params: {
      minTransferCount: params.minTransferCount,
      minTotalAmount: params.minTotalAmount.toString(),
      minConsistencyBps: params.minConsistencyBps,
      creditMultiplierBps: params.creditMultiplierBps,
      maxCreditLimit: params.maxCreditLimit.toString(),
      lookbackWindowSeconds: params.lookbackWindowSeconds,
      maxStalenessSeconds: params.maxStalenessSeconds,
    },
  };
}

export async function requestCreditReview(borrower: string) {
  const client = requireRelayerClient();
  const record = await client.getBorrower(borrower);
  if (!record.registered) throw new V1Error("NOT_REGISTERED", "Borrower is not registered.", 404);
  const tx = await client.requestCreditReview(borrower);
  const receipt = await tx.wait();
  const updated = await client.getBorrower(borrower);
  await activityStore.append({
    borrower,
    type: "credit_reviewed",
    data: {
      eligible: updated.eligible,
      creditLimit: updated.creditLimit,
      riskScoreBps: updated.riskScoreBps,
      txHash: receipt?.hash ?? tx.hash,
    },
  });
  return {
    wallet: getAddress(borrower),
    eligible: updated.eligible,
    creditLimit: updated.creditLimit,
    riskScoreBps: updated.riskScoreBps,
    lastReviewedAt: updated.lastReviewedAt,
    txHash: receipt?.hash ?? tx.hash,
    status: "confirmed" as const,
  };
}

export async function getLoanStatus(borrower: string) {
  const profile = await getWalletProfile(borrower);
  return {
    wallet: profile.address,
    registered: profile.registered,
    creditLimit: profile.creditLimit,
    outstandingPrincipal: profile.outstandingPrincipal,
    availableCredit: profile.availableCredit,
    model: "revolving_principal" as const,
  };
}

export async function requestLoan(borrower: string, amount: string) {
  const client = requireRelayerClient();
  const record = await client.getBorrower(borrower);
  if (!record.registered) throw new V1Error("NOT_REGISTERED", "Borrower is not registered.", 404);
  if (!record.eligible) {
    throw new V1Error("NOT_ELIGIBLE", "Borrower is not eligible under current credit rules.", 403);
  }
  const available = await client.getAvailableCredit(borrower);
  if (BigInt(amount) > BigInt(available)) {
    throw new V1Error("INSUFFICIENT_CREDIT", "Requested amount exceeds available credit.", 422, {
      requested: amount,
      available,
      currency: "loan_token_raw",
    });
  }
  if (BigInt(amount) <= 0n) throw new V1Error("VALIDATION_ERROR", "Amount must be greater than zero.", 400);
  const tx = await client.requestLoan(borrower, amount);
  const receipt = await tx.wait();
  const updated = await client.getBorrower(borrower);
  const newAvailable = await client.getAvailableCredit(borrower);
  await activityStore.append({
    borrower,
    type: "loan_disbursed",
    data: { amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash },
  });
  return {
    wallet: getAddress(borrower),
    amount,
    outstandingPrincipal: updated.outstandingPrincipal,
    availableCredit: newAvailable,
    txHash: receipt?.hash ?? tx.hash,
    status: "confirmed" as const,
  };
}

export async function repayLoan(borrower: string, amount: string) {
  const client = requireRelayerClient();
  const record = await client.getBorrower(borrower);
  if (!record.registered) throw new V1Error("NOT_REGISTERED", "Borrower is not registered.", 404);
  if (BigInt(amount) <= 0n) throw new V1Error("VALIDATION_ERROR", "Amount must be greater than zero.", 400);
  if (BigInt(amount) > BigInt(record.outstandingPrincipal)) {
    throw new V1Error("REPAY_EXCEEDS_OUTSTANDING", "Repayment exceeds outstanding principal.", 422, {
      amount,
      outstanding: record.outstandingPrincipal,
    });
  }
  const loanAddress = await client.loan.getAddress();
  const allowance: bigint = await client.loanToken.allowance(borrower, loanAddress);
  if (allowance < BigInt(amount)) {
    throw new V1Error(
      "INSUFFICIENT_ALLOWANCE",
      "Borrower has not approved enough loan-token allowance. Call approve() on the loan token from the borrower wallet first.",
      400,
      {
        required: amount,
        allowance: allowance.toString(),
        loanToken: await client.loanToken.getAddress(),
        spender: loanAddress,
      }
    );
  }
  const tx = await client.repay(borrower, amount);
  const receipt = await tx.wait();
  const updated = await client.getBorrower(borrower);
  const newAvailable = await client.getAvailableCredit(borrower);
  await activityStore.append({
    borrower,
    type: "loan_repaid",
    data: { amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash },
  });
  return {
    wallet: getAddress(borrower),
    amount,
    outstandingPrincipal: updated.outstandingPrincipal,
    availableCredit: newAvailable,
    txHash: receipt?.hash ?? tx.hash,
    status: "confirmed" as const,
  };
}

export async function listTransfers(borrower: string) {
  const transfers = await getReadClient().getVerifiedTransfers(borrower);
  return {
    wallet: getAddress(borrower),
    transfers: transfers.map((t) => ({
      sourceTxHash: t.sourceTxHash,
      sender: getAddress(t.sender),
      recipient: getAddress(borrower),
      amount: t.amount,
      sourceTimestamp: t.sourceTimestamp,
      recordedAt: t.recordedAt,
      verificationState: "proven" as const,
    })),
  };
}

export async function getTransferStats(borrower: string, windowSeconds?: number) {
  const lookback = windowSeconds ?? DEFAULT_LOOKBACK;
  const stats = await getReadClient().getStats(borrower, lookback);
  return {
    wallet: getAddress(borrower),
    windowSeconds: lookback,
    stats: {
      transferCount: stats.transferCount,
      totalAmount: stats.totalAmount,
      firstTimestamp: stats.firstTimestamp,
      lastTimestamp: stats.lastTimestamp,
      avgIntervalSeconds: stats.avgIntervalSeconds,
      consistencyBps: stats.intervalConsistencyBps,
    },
  };
}

export async function verifyTransfer(borrower: string, sourceTxHash: string) {
  const client = getReadClient();
  if (await client.isTransferRecorded(sourceTxHash)) {
    throw new V1Error("DUPLICATE_TRANSFER", "This source transfer is already verified and recorded on-chain.", 409, {
      sourceTxHash,
    });
  }
  const config = getConfig();
  if (!config.worker.privateKey) {
    throw new V1Error(
      "SERVICE_UNAVAILABLE",
      "No worker/submitter key configured (WORKER_PRIVATE_KEY). Cannot build Attestcoin proofs.",
      503,
      undefined,
      true
    );
  }
  let submitRemittanceProofForTx: (
    config: ReturnType<typeof getConfig>,
    signingClient: RemitCreditClient,
    borrower: string,
    sourceTxHash: string
  ) => Promise<{ onchainTxHash: string; amount: string; sourceTxHash: string }>;
  try {
    const mod = await import("../../../worker/src/submitProof");
    submitRemittanceProofForTx = mod.submitRemittanceProofForTx;
  } catch {
    throw new V1Error(
      "SERVICE_UNAVAILABLE",
      "Proof submission module is not available in this deployment.",
      503,
      undefined,
      true
    );
  }
  const signingClient = new RemitCreditClient(config, config.worker.privateKey);
  const result = await submitRemittanceProofForTx(config, signingClient, borrower, sourceTxHash);
  await activityStore.append({
    borrower,
    type: "remittance_verified",
    data: { sourceTxHash, onchainTxHash: result.onchainTxHash, amount: result.amount },
  });
  return {
    verified: true,
    wallet: getAddress(borrower),
    sourceTxHash: result.sourceTxHash,
    amount: result.amount,
    onchainTxHash: result.onchainTxHash,
    status: "confirmed" as const,
    checks: { notAlreadyRecorded: true, proofSubmitted: true, onchainConfirmed: true },
  };
}

export async function listActivity(borrower: string | null, limit = 50) {
  if (borrower) return { events: await activityStore.listForBorrower(borrower, limit) };
  return { events: await activityStore.listAll(limit) };
}

export async function getProtocolInfo() {
  const config = getConfig();
  const client = getReadClient();
  let relayer: string | null = null;
  let decimals: number | null = null;
  try {
    relayer = await client.getRelayer();
  } catch {
    /* optional */
  }
  try {
    decimals = await client.loanTokenDecimals();
  } catch {
    /* optional */
  }
  return {
    networkEnv: config.networkEnv,
    creditcoin: { chainId: config.creditcoin.chainId, rpcUrlConfigured: Boolean(config.creditcoin.rpcUrl) },
    sourceChain: { chainKey: config.sourceChain.chainKey, remittanceToken: config.sourceChain.remittanceTokenAddress },
    contracts: {
      remittanceMicroLoan: config.contracts.remittanceMicroLoan,
      creditRegistry: config.contracts.creditRegistry,
      creditDecisionEngine: config.contracts.creditDecisionEngine,
      loanStablecoin: config.contracts.loanStablecoin,
    },
    usc: {
      proverApiUrlConfigured: Boolean(config.usc.proverApiUrl),
      precompileAddress: config.usc.precompileAddress,
    },
    relayer,
    loanTokenDecimals: decimals,
    notes: [
      "Authoritative business state lives on-chain.",
      "Off-chain state (activity, nonces, sessions, idempotency) lives in Redis.",
      "Write operations are submitted by the backend relayer after SIWE auth.",
      "Repay requires the borrower to approve the loan token allowance from their wallet first.",
    ],
  };
}
