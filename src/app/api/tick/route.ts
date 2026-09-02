// app/api/tick/route.ts
//
// Slim tick — confirmation + credit review only.
// Source-chain scanning was moved to the Alchemy webhook
// (app/api/alchemy/remittance). This route is intended to be hit by
// Vercel Cron (or any external scheduler) every 1–2 minutes.
//
// Flow:
//   1. Resolve in-flight proof / review txs
//        - confirmed proof  → pendingReviewStore.add(borrower)
//        - confirmed review → clear
//        - reverted proof   → log
//        - reverted review  → re-queue borrower
//   2. Fire any queued credit reviews (requestCreditReview)

import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "../../../../shared/config";
import { RemitCreditClient } from "../../../../shared/services/contractClient";
import { inFlightTxStore } from "../../../../shared/services/inFlightTxStore";
import { pendingReviewStore } from "../../../../shared/services/pendingReviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

class UnauthorizedError extends Error {}

function assertAuthorized(req: NextRequest): void {
  const secret = process.env.WORKER_TICK_SECRET;

  if (!secret) {
    throw new Error(
      "WORKER_TICK_SECRET is not set — refusing to run an unprotected tick endpoint"
    );
  }

  const providedSecret = req.nextUrl.searchParams.get("worker_tick_secret");
  if (providedSecret !== secret) {
    throw new UnauthorizedError();
  }
}

export async function GET(req: NextRequest) {
  try {
    assertAuthorized(req);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("[tick] auth misconfiguration:", error);
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const summary = {
    confirmedProofs: 0,
    confirmedReviews: 0,
    revertedProofs: 0,
    revertedReviews: 0,
    reviewsSent: 0,
  };

  try {
    const config = loadConfig();
    const client = new RemitCreditClient(config, config.worker.privateKey);

    // ── 1. Resolve transactions broadcast earlier (webhook or previous tick)
    for (const kind of ["proof", "review"] as const) {
      for (const entry of await inFlightTxStore.list(kind)) {
        const receipt = await client.provider.getTransactionReceipt(entry.txHash);

        if (!receipt) continue; // still pending

        await inFlightTxStore.remove(kind, entry.txHash);

        if (receipt.status === 1) {
          if (kind === "proof") {
            summary.confirmedProofs++;
            // Proof confirmed → queue credit review (review AFTER proof)
            await pendingReviewStore.add(entry.borrower);
            console.log(
              `[tick] proof confirmed ${entry.txHash} → queued review for ${entry.borrower}`
            );
          } else {
            summary.confirmedReviews++;
            console.log(`[tick] review confirmed ${entry.txHash} for ${entry.borrower}`);
          }
        } else {
          console.error(
            `[tick] ${kind} tx ${entry.txHash} for ${entry.borrower} reverted`
          );
          if (kind === "proof") {
            summary.revertedProofs++;
          } else {
            summary.revertedReviews++;
            // Re-queue so we try the review again
            await pendingReviewStore.add(entry.borrower);
          }
        }
      }
    }

    // ── 2. Fire queued credit reviews
    for (const borrower of await pendingReviewStore.list()) {
      // Remove first so a crash mid-send doesn't double-fire forever;
      // on failure we re-add below.
      await pendingReviewStore.remove(borrower);

      try {
        const tx = await client.requestCreditReview(borrower);

        await inFlightTxStore.add("review", {
          txHash: tx.hash,
          borrower,
          submittedAt: Date.now(),
        });

        summary.reviewsSent++;
        console.log(`[tick] review sent for ${borrower} tx=${tx.hash}`);
      } catch (error) {
        console.error(`[tick] failed to send review for ${borrower}:`, error);
        await pendingReviewStore.add(borrower);
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[tick] fatal error:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
