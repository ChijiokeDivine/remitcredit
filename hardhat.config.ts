// hardhat.config.ts
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
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
      url: process.env.CC3_TESTNET_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network",
      accounts,
      chainId: Number(process.env.CC3_TESTNET_CHAIN_ID ?? 102031),
    },
    cc3Mainnet: {
      url: process.env.CC3_MAINNET_RPC_URL ?? "",
      accounts,
      chainId: Number(process.env.CC3_MAINNET_CHAIN_ID ?? 102030),
    },
  },
  etherscan: {
    apiKey: {
      cc3Testnet: "empty",
    },
    customChains: [
      {
        network: "cc3Testnet",
        chainId: 102031,
        urls: {
          apiURL: "https://creditcoin-testnet.blockscout.com/api",
          browserURL: "https://creditcoin-testnet.blockscout.com",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;