// worker/src/runAgentLoop.ts
import { RemitCreditConfig } from "../../shared/config";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { decideCreditLine, CreditAgentParams } from "../../shared/services/creditAgent";
import { pendingReviewStore } from "../../shared/services/pendingReviewStore";

/// Tracks which borrowers had a verified remittance land since their last
/// on-chain credit review, and triggers requestCreditReview for them. Kept
/// separate from the monitor so the "when do we re-decide" policy can
/// evolve independently of "when do we notice a new remittance" — e.g.
/// batching reviews, rate-limiting gas spend, or reacting to param changes.
export class AgentLoop {
  private readonly config: RemitCreditConfig;
  private readonly client: RemitCreditClient;
  private pendingReview = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(config: RemitCreditConfig, client: RemitCreditClient) {
    this.config = config;
    this.client = client;
  }

  /// Call this whenever the monitor records a new verified transfer for a
  /// borrower, to flag them for review on the next tick. Persisted
  /// immediately so a crash before the next tick doesn't lose it.
  markDirty(borrower: string): void {
    const key = borrower.toLowerCase();
    this.pendingReview.add(key);
    pendingReviewStore
      .add(key)
      .catch((error) => console.error(`[agent-loop] failed to persist pending review for ${key}:`, error));
  }

  async start(): Promise<void> {
    // Recover anything left over from a previous run (e.g. a crash between
    // markDirty and a successful requestCreditReview).
    try {
      const recovered = await pendingReviewStore.list();
      for (const borrower of recovered) this.pendingReview.add(borrower.toLowerCase());
      if (recovered.length > 0) {
        console.log(`[agent-loop] recovered ${recovered.length} pending review(s) from last run`);
      }
    } catch (error) {
      console.error("[agent-loop] failed to recover pending reviews:", error);
    }

    this.timer = setInterval(() => {
      this.tick().catch((error) => console.error("[agent-loop] tick failed:", error));
    }, this.config.worker.pollIntervalMs);
    console.log(`[agent-loop] running every ${this.config.worker.pollIntervalMs}ms`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.pendingReview.size === 0) return;
    const borrowers = Array.from(this.pendingReview);
    this.pendingReview.clear();

    for (const borrower of borrowers) {
      try {
        const tx = await this.client.requestCreditReview(borrower);
        await tx.wait();
        console.log(`[agent-loop] reviewed ${borrower} (tx ${tx.hash})`);
        // Only clear the durable record once the review has actually landed
        // on-chain — if the process dies before this line, the borrower
        // stays queued in Redis and gets picked back up on the next start().
        await pendingReviewStore
          .remove(borrower)
          .catch((error) => console.error(`[agent-loop] failed to clear persisted review for ${borrower}:`, error));
      } catch (error) {
        console.error(`[agent-loop] review failed for ${borrower}:`, error);
        // Re-queue for the next tick rather than dropping it silently.
        // It was never removed from the store above, so no extra write needed.
        this.pendingReview.add(borrower);
      }
    }
  }

  /// Off-chain preview of a decision, without spending gas — used by the
  /// backend's /credit/:borrower endpoint. `params` should mirror the
  /// on-chain CreditDecisionEngine's current params (fetch once, cache,
  /// refresh on ParamsUpdated events in a fuller implementation).
  async previewDecision(borrower: string, params: CreditAgentParams) {
    const stats = await this.client.getStats(borrower, params.lookbackWindowSeconds);
    return decideCreditLine(stats, params);
  }
}