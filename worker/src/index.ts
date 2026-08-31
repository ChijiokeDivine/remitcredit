// worker/src/index.ts
import { loadConfig } from "../../shared/config";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { ProofService } from "../../shared/services/proofService";
import { RemittanceMonitor } from "./monitor";
import { AgentLoop } from "./runAgentLoop";

async function main() {
  const config = loadConfig();
  console.log(`[worker] starting on ${config.networkEnv}`);

  const client = new RemitCreditClient(config, config.worker.privateKey);

  const proofService = new ProofService(config);
  await proofService.assertChainSupported();

  const agentLoop = new AgentLoop(config, client);

  const monitor = new RemittanceMonitor(config, client, {
    onSubmitted: ({ borrower }) => agentLoop.markDirty(borrower),
    onError: (error, ctx) => console.error("[worker] monitor error:", ctx, error),
  });

  await monitor.start();
  await agentLoop.start();

  const shutdown = () => {
    console.log("[worker] shutting down");
    monitor.stop();
    agentLoop.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker] fatal error:", error);
  process.exit(1);
});