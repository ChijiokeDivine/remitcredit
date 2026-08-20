// worker/src/runAgentLoop.ts
import { RemitCreditConfig } from "../../shared/config";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { decideCreditLine, CreditAgentParams } from "../../shared/services/creditAgent";

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
  /// borrower, to flag them for review on the next tick.
  markDirty(borrower: string): void {
    this.pendingReview.add(borrower.toLowerCase());
  }

  start(): void {
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
      } catch (error) {
        console.error(`[agent-loop] review failed for ${borrower}:`, error);
        // Re-queue for the next tick rather than dropping it silently.
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
