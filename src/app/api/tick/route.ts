// app/api/tick/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import { loadConfig } from "../../../../shared/config";
import { RemitCreditClient } from "../../../../shared/services/contractClient";
import { ERC20_ABI } from "../../../../shared/abi";
import { buildSenderToBorrowersMap } from "../../../../shared/services/borrowerRegistry";
import { checkpointStore } from "../../../../shared/services/checkpointStore";
import { inFlightTxStore } from "../../../../shared/services/inFlightTxStore";
import { pendingReviewStore } from "../../../../shared/services/pendingReviewStore";
import {
  sendRemittanceProofTx,
  AlreadyRecordedError,
} from "../../../../shared/services/remittanceProofTx";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BLOCK_SPAN = 2000;

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
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  const summary = {
    confirmedProofs: 0,
    confirmedReviews: 0,
    revertedProofs: 0,
    revertedReviews: 0,
    newProofsSent: 0,
    reviewsSent: 0,
    scannedFrom: 0,
    scannedTo: 0,
  };

  try {
    const config = loadConfig();
    const client = new RemitCreditClient(config, config.worker.privateKey);

    // ── 1. Resolve transactions broadcast on a previous tick ───────────
    for (const kind of ["proof", "review"] as const) {
      for (const entry of await inFlightTxStore.list(kind)) {
        const receipt = await client.provider.getTransactionReceipt(
          entry.txHash
        );

        if (!receipt) continue;

        await inFlightTxStore.remove(kind, entry.txHash);

        if (receipt.status === 1) {
          if (kind === "proof") {
            summary.confirmedProofs++;
            await pendingReviewStore.add(entry.borrower);
          } else {
            summary.confirmedReviews++;
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

    // ── 2. Scan the source chain for new remittances ────────────────────
    const sourceProvider = new JsonRpcProvider(
      config.sourceChain.rpcUrl
    );

    const remittanceToken = new Contract(
      config.sourceChain.remittanceTokenAddress,
      ERC20_ABI,
      sourceProvider
    );

    const currentBlock = await sourceProvider.getBlockNumber();
    const lastScanned = await checkpointStore.get();

    const backfillBlocks = Number(
      process.env.WORKER_BACKFILL_BLOCKS ?? "0"
    );

    const fromBlock =
      lastScanned !== null
        ? lastScanned + 1
        : Math.max(0, currentBlock - backfillBlocks);

    const toBlock = Math.min(
      currentBlock,
      fromBlock + MAX_BLOCK_SPAN
    );

    summary.scannedFrom = fromBlock;
    summary.scannedTo = toBlock;

    if (fromBlock <= toBlock) {
      const senderToBorrowers =
        await buildSenderToBorrowersMap(client);

      const logs = await remittanceToken.queryFilter(
        remittanceToken.filters.Transfer(),
        fromBlock,
        toBlock
      );

      for (const log of logs) {
        if (!("args" in log) || !log.args) continue;

        const [from, to] = log.args as unknown as [
          string,
          string,
          bigint
        ];

        const borrowers = senderToBorrowers.get(
          (from as string).toLowerCase()
        );

        if (
          !borrowers ||
          !borrowers.has((to as string).toLowerCase())
        ) {
          continue;
        }

        const txHash = log.transactionHash;

        const alreadyInFlight = (
          await inFlightTxStore.list("proof")
        ).some((e) => e.sourceTxHash === txHash);

        if (alreadyInFlight) continue;

        try {
          const sent = await sendRemittanceProofTx(
            config,
            client,
            to as string,
            txHash
          );

          await inFlightTxStore.add("proof", {
            txHash: sent.tx.hash,
            borrower: to as string,
            sourceTxHash: txHash,
            submittedAt: Date.now(),
          });

          summary.newProofsSent++;
        } catch (error) {
          if (error instanceof AlreadyRecordedError) continue;

          console.error(
            `[tick] failed to submit proof for ${txHash} (borrower ${to}):`,
            error
          );
        }
      }

      await checkpointStore.set(toBlock);
    }

    // ── 3. Fire any queued credit reviews ───────────────────────────────
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
      } catch (error) {
        console.error(
          `[tick] failed to send review for ${borrower}:`,
          error
        );

        await pendingReviewStore.add(borrower);
      }
    }

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    console.error("[tick] fatal error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}