// scripts/fundUser.ts
// Mints mUSD directly to an arbitrary wallet — no pool, no approve, just a
// balance in their wallet so they have something to repay a loan with (or
// to test with generally).
//
// Usage:
//   FUND_TO_ADDRESS=0xabc... FUND_AMOUNT=100 npx hardhat run scripts/fundUser.ts --network cc3Testnet

import { ethers } from "hardhat";

async function main() {
  const to = process.env.FUND_TO_ADDRESS;
  const amountDisplay = process.env.FUND_AMOUNT ?? "100"; // display units, e.g. "100" mUSD

  if (!to) {
    throw new Error("Set FUND_TO_ADDRESS to the wallet you want to fund");
  }

  const loanTokenAddress = process.env.LOAN_STABLECOIN_ADDRESS_TESTNET;
  if (!loanTokenAddress) {
    throw new Error("Set LOAN_STABLECOIN_ADDRESS_TESTNET in .env");
  }

  const [deployer] = await ethers.getSigners();
  const mockStablecoin = await ethers.getContractAt("MockStablecoin", loanTokenAddress, deployer);

  const decimals = await mockStablecoin.decimals(); // 6
  const amount = ethers.parseUnits(amountDisplay, decimals);

  console.log(`Minting ${amountDisplay} mUSD (${amount.toString()} base units) to ${to}...`);
  const tx = await mockStablecoin.mint(to, amount);
  await tx.wait();

  const balance = await mockStablecoin.balanceOf(to);
  console.log(`Done. ${to} now holds ${ethers.formatUnits(balance, decimals)} mUSD.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});