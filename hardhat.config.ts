// hardhat.config.ts
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

// NOTE on RPC URLs: fill these in .env. The Sepolia network here is only
// used to deploy/interact with mock "source chain" contracts (e.g. the
// mock stablecoin borrowers receive remittances in) for demo purposes —
// real remittances can be plain ERC20 transfers on any Attestcoin-supported
// source chain, no special contract required. cc3Testnet / cc3Mainnet are
// where the actual Attestcoin Smart Contracts (RemittanceMicroLoan etc.)
// get deployed, since that's where the native verifier precompile lives.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // local-only network, used with MockAttestcoinBlockProver for unit tests
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://sepolia.infura.io/v3/",
      accounts,
      chainId: 11155111,
    },
    ethereumMainnet: {
      url: process.env.ETHEREUM_MAINNET_RPC_URL ?? "",
      accounts,
      chainId: 1,
    },
    cc3Testnet: {
      // See https://docs.creditcoin.org/environments/testnet for the
      // canonical RPC URL; overridable via .env.
      url: process.env.CC3_TESTNET_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network",
      accounts,
      chainId: Number(process.env.CC3_TESTNET_CHAIN_ID ?? 102031),
    },
    cc3Mainnet: {
      // See https://docs.creditcoin.org/environments/mainnet — confirm the
      // exact RPC URL and chain ID against that page before deploying real
      // funds; both are overridable via .env so this file never needs edits.
      url: process.env.CC3_MAINNET_RPC_URL ?? "",
      accounts,
      chainId: Number(process.env.CC3_MAINNET_CHAIN_ID ?? 102030),
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
