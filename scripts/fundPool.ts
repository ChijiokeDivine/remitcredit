// scripts/fundPool.ts
// Mints mUSD to the deployer, approves RemittanceMicroLoan, and calls
// fundPool() so the pool balance shows up with a proper PoolFunded event.
//
// Usage:
//   npx hardhat run scripts/fundPool.ts --network cc3Testnet

import { ethers } from "hardhat";

// Adjust this — it's a *display* amount, decimals are applied below.
const AMOUNT_TO_MINT = "1000000"; // 1,000,000 mUSD

async function main() {
  const [deployer] = await ethers.getSigners();

  const loanTokenAddress = process.env.LOAN_STABLECOIN_ADDRESS_TESTNET;
  const loanContractAddress = process.env.REMITTANCE_MICRO_LOAN_ADDRESS_TESTNET;

  if (!loanTokenAddress || !loanContractAddress) {
    throw new Error(
      "Set LOAN_STABLECOIN_ADDRESS_TESTNET and REMITTANCE_MICRO_LOAN_ADDRESS_TESTNET in .env"
    );
  }

  const mockStablecoin = await ethers.getContractAt("MockStablecoin", loanTokenAddress, deployer);
  const remittanceMicroLoan = await ethers.getContractAt(
    "RemittanceMicroLoan",
    loanContractAddress,
    deployer
  );

  const decimals = await mockStablecoin.decimals(); // 6
  const amount = ethers.parseUnits(AMOUNT_TO_MINT, decimals);

  console.log(`Minting ${AMOUNT_TO_MINT} mUSD (${amount.toString()} base units) to ${deployer.address}...`);
  let tx = await mockStablecoin.mint(deployer.address, amount);
  await tx.wait();

  console.log(`Approving RemittanceMicroLoan (${loanContractAddress}) to pull ${AMOUNT_TO_MINT} mUSD...`);
  tx = await mockStablecoin.approve(loanContractAddress, amount);
  await tx.wait();

  console.log(`Calling fundPool(${amount.toString()})...`);
  tx = await remittanceMicroLoan.fundPool(amount);
  await tx.wait();

  const poolBalance = await mockStablecoin.balanceOf(loanContractAddress);
  console.log(`Done. Pool balance is now ${ethers.formatUnits(poolBalance, decimals)} mUSD.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});