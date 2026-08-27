// scripts/checkRegistryState.ts
import { JsonRpcProvider, Contract } from "ethers";
import { loadConfig } from "../shared/config";
import { REMITTANCE_CREDIT_REGISTRY_ABI } from "../shared/abi";

const BORROWER = "0x9cA5D1273637A12dA5563D383693F8a7e3a67821";

async function main() {
  const config = loadConfig();
  const provider = new JsonRpcProvider(config.creditcoin.rpcUrl);
  const registry = new Contract(
    config.contracts.creditRegistry,
    REMITTANCE_CREDIT_REGISTRY_ABI,
    provider
  );

  const transfers = await registry.getTransfers(BORROWER);
  console.log(`recorded transfers for ${BORROWER}:`, transfers.length);
  for (const t of transfers) {
    console.log({
      sender: t.sender,
      amount: t.amount.toString(),
      sourceTimestamp: t.sourceTimestamp.toString(),
      sourceTxHash: t.sourceTxHash,
      recordedAt: t.recordedAt.toString(),
    });
  }

  if (transfers.length > 0) {
    const last = transfers[transfers.length - 1];
    console.log("\nlast recorded sourceTimestamp:", last.sourceTimestamp.toString());
    console.log(
      "-> any new submission needs claimedTimestamp >= this value, or it will revert"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});