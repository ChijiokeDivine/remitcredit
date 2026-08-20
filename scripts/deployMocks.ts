// scripts/deployMocks.ts
//
// Deploys a mock stablecoin on the SOURCE chain (Sepolia) purely so a demo
// can generate realistic-looking "remittance" transfers for the worker to
// pick up and prove. Real remittances on mainnet need no special contract
// at all — any ERC20 (or native) transfer on a supported source chain is
// provable as-is. Usage:
//   npx hardhat run scripts/deployMocks.ts --network sepolia
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying demo remittance token to ${network.name} as ${deployer.address}`);

  const Token = await ethers.getContractFactory("MockStablecoin");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();

  console.log("Demo remittance token (mUSD) deployed:", await token.getAddress());
  console.log("Mint to a demo 'family sender' wallet with token.mint(address, amount).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
