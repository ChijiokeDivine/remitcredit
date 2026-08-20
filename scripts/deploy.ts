// scripts/deploy.ts
//
// Deploys the full RemitCredit stack to whichever Creditcoin network was
// passed via --network (cc3Testnet or cc3Mainnet — see hardhat.config.ts).
// Usage:
//   npx hardhat run scripts/deploy.ts --network cc3Testnet
//   npx hardhat run scripts/deploy.ts --network cc3Mainnet
//
// On testnet this also deploys MockStablecoin as the loan currency. On
// mainnet, set LOAN_TOKEN_ADDRESS_MAINNET in .env to a real asset instead
// (e.g. a bridged/native stablecoin on Creditcoin) — the script will use it
// if present rather than deploying a mock.
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const PRECOMPILE_ADDRESS =
  process.env.ATTESTCOIN_BLOCK_PROVER_PRECOMPILE_ADDRESS ??
  "0x0000000000000000000000000000000000000FD2";

const DEFAULT_CREDIT_PARAMS = {
  minTransferCount: 3,
  minTotalAmount: ethers.parseUnits("300", 6),
  minConsistencyBps: 5000,
  creditMultiplierBps: 3000,
  maxCreditLimit: ethers.parseUnits("1000", 6),
  lookbackWindowSeconds: 180 * 24 * 60 * 60,
  maxStalenessSeconds: 60 * 24 * 60 * 60,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const isMainnet = network.name === "cc3Mainnet";

  console.log(`Deploying RemitCredit to ${network.name} as ${deployer.address}`);

  // 1. Loan currency
  let loanTokenAddress = isMainnet
    ? process.env.LOAN_TOKEN_ADDRESS_MAINNET
    : process.env.LOAN_TOKEN_ADDRESS_TESTNET;

  if (!loanTokenAddress) {
    if (isMainnet) {
      throw new Error(
        "LOAN_TOKEN_ADDRESS_MAINNET is not set — refusing to deploy a mock stablecoin on mainnet. " +
          "Set it to a real asset address in .env and re-run."
      );
    }
    console.log("No LOAN_TOKEN_ADDRESS_TESTNET set — deploying MockStablecoin for testnet.");
    const Token = await ethers.getContractFactory("MockStablecoin");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    loanTokenAddress = await token.getAddress();
    console.log("MockStablecoin deployed:", loanTokenAddress);
  }

  // 2. Credit registry
  const Registry = await ethers.getContractFactory("RemittanceCreditRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log("RemittanceCreditRegistry deployed:", await registry.getAddress());

  // 3. Credit decision engine
  const Engine = await ethers.getContractFactory("CreditDecisionEngine");
  const engine = await Engine.deploy(deployer.address, DEFAULT_CREDIT_PARAMS);
  await engine.waitForDeployment();
  console.log("CreditDecisionEngine deployed:", await engine.getAddress());

  // 4. Main ASC
  const Loan = await ethers.getContractFactory("RemittanceMicroLoan");
  const loan = await Loan.deploy(
    deployer.address,
    PRECOMPILE_ADDRESS,
    await registry.getAddress(),
    await engine.getAddress(),
    loanTokenAddress
  );
  await loan.waitForDeployment();
  console.log("RemittanceMicroLoan deployed:", await loan.getAddress());

  // 5. Wire the registry to trust only the loan contract as its recorder.
  const setRecorderTx = await registry.setRecorder(await loan.getAddress());
  await setRecorderTx.wait();
  console.log("Registry recorder set to RemittanceMicroLoan.");

  console.log("\n=== Deployment summary ===");
  console.log("Network:                ", network.name);
  console.log("Loan token:              ", loanTokenAddress);
  console.log("RemittanceCreditRegistry:", await registry.getAddress());
  console.log("CreditDecisionEngine:    ", await engine.getAddress());
  console.log("RemittanceMicroLoan:     ", await loan.getAddress());
  console.log("\nAdd these to your .env as:");
  const suffix = isMainnet ? "MAINNET" : "TESTNET";
  console.log(`REMITTANCE_MICRO_LOAN_ADDRESS_${suffix}=${await loan.getAddress()}`);
  console.log(`CREDIT_REGISTRY_ADDRESS_${suffix}=${await registry.getAddress()}`);
  console.log(`CREDIT_DECISION_ENGINE_ADDRESS_${suffix}=${await engine.getAddress()}`);
  console.log(`LOAN_STABLECOIN_ADDRESS_${suffix}=${loanTokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
