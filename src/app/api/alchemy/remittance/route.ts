// app/api/alchemy/remittance/route.ts
//
// Alchemy Custom Webhook receiver for source-chain ERC-20 Transfer events.
// On a tracked (declaredSender → borrower) remittance:
//   1. sendRemittanceProofTx  (broadcast, do not wait for confirmation)
//   2. record in inFlightTxStore so the slim /api/tick can confirm later
//      and queue the credit review.
//
// Credit review itself stays in /api/tick so it only runs AFTER the proof
// tx has confirmed on Creditcoin (matches "review after proof").
//
// Tracking check uses isDeclaredSender (eth_call) per transfer — not a full
// eth_getLogs rebuild of the registry (that times out on Creditcoin RPC).

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
    // Alchemy test pings / empty blocks — acknowledge so they stop retrying.
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const config = loadConfig();
  if (!config.worker.privateKey) {
    console.error("[alchemy/remittance] WORKER_PRIVATE_KEY is not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }

  const client = new RemitCreditClient(config, config.worker.privateKey);

  let processed = 0;
  const results: Array<{ txHash: string; status: string; borrower?: string }> = [];

  for (const { from, to, txHash } of transfers) {
    // Cheap per-pair check — avoids eth_getLogs from genesis on Creditcoin
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

    const alreadyInFlight = (await inFlightTxStore.list("proof")).some(
      (e) => e.sourceTxHash?.toLowerCase() === txHash.toLowerCase()
    );
    if (alreadyInFlight) {
      results.push({ txHash, status: "already_in_flight", borrower: to });
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
      results.push({ txHash, status: "proof_sent", borrower: to });
      console.log(
        `[alchemy/remittance] proof sent source=${txHash} onchain=${sent.tx.hash} borrower=${to}`
      );
    } catch (err) {
      if (err instanceof AlreadyRecordedError) {
        results.push({ txHash, status: "already_recorded", borrower: to });
        continue;
      }
      console.error(`[alchemy/remittance] failed proof for ${txHash}:`, err);
      results.push({ txHash, status: "error", borrower: to });
      // Still 200 — permanent failures should not cause Alchemy retries.
      // Transient cases can be recovered via /api/remittances/verify or a future tick.
    }
  }

  return NextResponse.json({ ok: true, processed, results });
}