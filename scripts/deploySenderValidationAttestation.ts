// scripts/deploySenderValidationAttestation.ts
//
// Deploys SenderValidationAttestation to Creditcoin (cc3Testnet / cc3Mainnet).
// Additive — does not touch RemittanceMicroLoan or other existing contracts.
//
// Usage:
//   npx hardhat run scripts/deploySenderValidationAttestation.ts --network cc3Testnet
//   npx hardhat run scripts/deploySenderValidationAttestation.ts --network cc3Mainnet
//
// Constructor: (initialOwner, initialWriter)
//   - owner  = deployer (or ATTESTATION_OWNER override)
//   - writer = address of BACKEND_RELAYER_PRIVATE_KEY (same key the API uses to call attest)

import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";
import * as dotenv from "dotenv";

const { ethers, network } = hre;

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const isMainnet = network.name === "cc3Mainnet";
  const suffix = isMainnet ? "MAINNET" : "TESTNET";

  console.log(
    `Deploying SenderValidationAttestation to ${network.name} as ${deployer.address}`
  );

  // Owner: can setWriter / transferOwnership later
  const initialOwner = process.env.ATTESTATION_OWNER ?? deployer.address;

  // Writer: must be the wallet that signs attest() from the backend pipeline.
  // Derive from the same BACKEND_RELAYER_PRIVATE_KEY the API already uses so
  // it never drifts (mirrors how deploy.ts sets loan.setRelayer).
  const relayerPrivateKey = process.env.BACKEND_RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error(
      "BACKEND_RELAYER_PRIVATE_KEY is not set — refusing to deploy without a writer. " +
        "The off-chain validation pipeline calls attest() with this key. " +
        "Set BACKEND_RELAYER_PRIVATE_KEY in .env and re-run."
    );
  }
  const initialWriter =
    process.env.ATTESTATION_WRITER ??
    new ethers.Wallet(relayerPrivateKey).address;

  console.log("Owner: ", initialOwner);
  console.log("Writer:", initialWriter);

  const Factory = await ethers.getContractFactory("SenderValidationAttestation");
  const attestation = await Factory.deploy(initialOwner, initialWriter);
  await attestation.waitForDeployment();

  const address = await attestation.getAddress();
  console.log("SenderValidationAttestation deployed:", address);

  // Sanity: on-chain writer matches what we intended
  const onChainWriter: string = await attestation.writer();
  if (onChainWriter.toLowerCase() !== initialWriter.toLowerCase()) {
    throw new Error(
      `Writer mismatch: expected ${initialWriter}, on-chain ${onChainWriter}`
    );
  }

  console.log("\n=== Deployment summary ===");
  console.log("Network:                        ", network.name);
  console.log("SenderValidationAttestation:    ", address);
  console.log("Owner:                          ", initialOwner);
  console.log("Writer (attest caller):         ", initialWriter);
  console.log("\nAdd this to your .env:");
  console.log(`SENDER_VALIDATION_ATTESTATION_ADDRESS_${suffix}=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});