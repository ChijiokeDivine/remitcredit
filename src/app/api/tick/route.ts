// app/api/tick/route.ts
//
// Slim tick — confirmation + credit review only.
// Designed to be triggered externally (e.g., cron-job.org, Upstash QStash, or GitHub Actions)
// every 1–2 minutes.

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
  const tickSecret = process.env.WORKER_TICK_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!tickSecret && !cronSecret) {
    throw new Error(
      "WORKER_TICK_SECRET or CRON_SECRET must be set — refusing unprotected tick"
    );
  }

  // 1. Check Bearer token (Standard Vercel Cron / QStash header)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  // 2. Check direct custom headers (e.g., cron-job.org header)
  const headerSecret = req.headers.get("x-cron-secret");

  // 3. Check query string parameter (?worker_tick_secret=xxx)
  const querySecret = req.nextUrl.searchParams.get("worker_tick_secret");

  const isAuthorized =
    (cronSecret && bearerToken === cronSecret) ||
    (cronSecret && headerSecret === cronSecret) ||
    (tickSecret && querySecret === tickSecret);

  if (!isAuthorized) throw new UnauthorizedError();
}

async function handleTick(req: NextRequest) {
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

    // ── 1. Resolve transactions broadcast earlier
    for (const kind of ["proof", "review"] as const) {
      for (const entry of await inFlightTxStore.list(kind)) {
        const receipt = await client.provider.getTransactionReceipt(entry.txHash);

        if (!receipt) continue; // still pending

        await inFlightTxStore.remove(kind, entry.txHash);

        if (receipt.status === 1) {
          if (kind === "proof") {
            summary.confirmedProofs++;
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
            await pendingReviewStore.add(entry.borrower);
          }
        }
      }
    }

    // ── 2. Fire queued credit reviews
    for (const borrower of await pendingReviewStore.list()) {
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

export async function GET(req: NextRequest) {
  return handleTick(req);
}

export async function POST(req: NextRequest) {
  return handleTick(req);
}