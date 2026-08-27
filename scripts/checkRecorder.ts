// scripts/checkRecorder.ts
import { JsonRpcProvider, Contract } from "ethers";
import { loadConfig } from "../shared/config";
import { REMITTANCE_CREDIT_REGISTRY_ABI } from "../shared/abi";

async function main() {
  const config = loadConfig();
  const provider = new JsonRpcProvider(config.creditcoin.rpcUrl);
  const registry = new Contract(
    config.contracts.creditRegistry,
    REMITTANCE_CREDIT_REGISTRY_ABI,
    provider
  );

  const recorder = await registry.recorder();
  console.log("registry.recorder():", recorder);
  console.log("RemittanceMicroLoan address:", config.contracts.remittanceMicroLoan);
  console.log(
    "match:",
    recorder.toLowerCase() === config.contracts.remittanceMicroLoan.toLowerCase()
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});