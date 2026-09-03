// app/api/alchemy/remittance/route.ts
//
// Extended Alchemy webhook: after proving a tracked transfer, update
// off-chain probation + reputation (Features 1–2). On-chain proof path
// is unchanged.

import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "../../../../../shared/config";
import { RemitCreditClient } from "../../../../../shared/services/contractClient";
import { inFlightTxStore } from "../../../../../shared/services/inFlightTxStore";
import {
  sendRemittanceProofTx,
  AlreadyRecordedError,
} from "../../../../../shared/services/remittanceProofTx";
import {
  verifyAlchemySignature,
  parseTransfersFromAlchemyPayload,
} from "../../../../server/alchemyWebhook";
import { handleVerifiedTransfer } from "../../../../../shared/services/senderLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-alchemy-signature");

  if (!verifyAlchemySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const transfers = parseTransfersFromAlchemyPayload(payload);
  if (transfers.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const config = loadConfig();
  if (!config.worker.privateKey) {
    console.error("[alchemy/remittance] WORKER_PRIVATE_KEY is not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }

  const client = new RemitCreditClient(config, config.worker.privateKey);

  let processed = 0;
  const results: Array<{
    txHash: string;
    status: string;
    borrower?: string;
    weightBps?: number;
    graduated?: boolean;
  }> = [];

  for (const { from, to, txHash, data } of transfers) {
    let isTracked = false;
    try {
      isTracked = await client.isDeclaredSender(to, from);
    } catch (err) {
      console.error(
        `[alchemy/remittance] isDeclaredSender failed borrower=${to} sender=${from}:`,
        err
      );
      results.push({ txHash, status: "error", borrower: to });
      continue;
    }

    if (!isTracked) {
      results.push({ txHash, status: "ignored_not_tracked", borrower: to });
      continue;
    }

    // Feature 1–2: look up probation weight BEFORE score attribution,
    // then increment graduation counters. Amount is best-effort from log data.
    let amount: string = "0";
    if (data && data !== "0x") {
      try {
        amount = BigInt(data).toString();
      } catch {
        amount = "0";
      }
    }

    let weightBps = 10000;
    let graduated = false;
    try {
      const lifecycle = await handleVerifiedTransfer(from, to, amount);
      weightBps = lifecycle.weightBps;
      graduated = lifecycle.graduated;
      console.log(
        `[alchemy/remittance] probation sender=${from} borrower=${to} weightBps=${weightBps} graduated=${graduated} — ${lifecycle.explanation}`
      );
      if (lifecycle.structuring?.flagged) {
        console.warn(
          `[alchemy/remittance] structuring signal sender=${from}: ${lifecycle.structuring.rationale}`
        );
      }
    } catch (err) {
      console.error("[alchemy/remittance] lifecycle hooks failed:", err);
      // Non-fatal — continue with proof submission
    }

    const alreadyInFlight = (await inFlightTxStore.list("proof")).some(
      (e) => e.sourceTxHash?.toLowerCase() === txHash.toLowerCase()
    );
    if (alreadyInFlight) {
      results.push({
        txHash,
        status: "already_in_flight",
        borrower: to,
        weightBps,
        graduated,
      });
      continue;
    }

    try {
      const sent = await sendRemittanceProofTx(config, client, to, txHash);

      await inFlightTxStore.add("proof", {
        txHash: sent.tx.hash,
        borrower: to,
        sourceTxHash: txHash,
        submittedAt: Date.now(),
      });

      processed++;
      results.push({
        txHash,
        status: "proof_sent",
        borrower: to,
        weightBps,
        graduated,
      });
      console.log(
        `[alchemy/remittance] proof sent source=${txHash} onchain=${sent.tx.hash} borrower=${to}`
      );
    } catch (err) {
      if (err instanceof AlreadyRecordedError) {
        results.push({
          txHash,
          status: "already_recorded",
          borrower: to,
          weightBps,
          graduated,
        });
        continue;
      }
      console.error(`[alchemy/remittance] failed proof for ${txHash}:`, err);
      results.push({ txHash, status: "error", borrower: to, weightBps });
    }
  }

  return NextResponse.json({ ok: true, processed, results });
}
