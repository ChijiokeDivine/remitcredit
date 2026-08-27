// scripts/checkCreditParams.ts
import { JsonRpcProvider, Contract } from "ethers";
import { loadConfig } from "../shared/config";
import { CREDIT_DECISION_ENGINE_ABI } from "../shared/abi";

async function main() {
  const config = loadConfig();
  const provider = new JsonRpcProvider(config.creditcoin.rpcUrl);
  const engine = new Contract(
    config.contracts.creditDecisionEngine,
    CREDIT_DECISION_ENGINE_ABI,
    provider
  );

  const p = await engine.params();
  console.log({
    minTransferCount: p.minTransferCount.toString(),
    minTotalAmount: p.minTotalAmount.toString(),
    minConsistencyBps: p.minConsistencyBps,
    creditMultiplierBps: p.creditMultiplierBps,
    maxCreditLimit: p.maxCreditLimit.toString(),
    lookbackWindowSeconds: p.lookbackWindowSeconds.toString(),
    maxStalenessSeconds: p.maxStalenessSeconds.toString(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});