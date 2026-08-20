// shared/config.ts
import * as dotenv from "dotenv";

dotenv.config();

export type NetworkEnv = "testnet" | "mainnet";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export interface RemitCreditConfig {
  networkEnv: NetworkEnv;

  sourceChain: {
    rpcUrl: string;
    wsRpcUrl: string; // optional; if set, the monitor subscribes over WebSocket instead of polling rpcUrl
    chainKey: number; // Creditcoin-internal chain identifier, not the EVM chainId
    remittanceTokenAddress: string; // ERC20 the monitor watches for incoming transfers (e.g. USDC)
  };

  creditcoin: {
    rpcUrl: string;
    chainId: number;
  };

  usc: {
    proverApiUrl: string;
    precompileAddress: string;
  };

  contracts: {
    remittanceMicroLoan: string;
    creditRegistry: string;
    creditDecisionEngine: string;
    loanStablecoin: string;
  };

  worker: {
    privateKey: string;
    pollIntervalMs: number;
  };

  backend: {
    port: number;
    relayerPrivateKey: string;
  };
}

/// Loads config for whichever network (testnet/mainnet) NETWORK_ENV points
/// at. Both worker and backend call this once at startup rather than
/// reading process.env scattered throughout — keeps the testnet/mainnet
/// switch to a single place.
export function loadConfig(): RemitCreditConfig {
  const networkEnv = (optionalEnv("NETWORK_ENV", "testnet") as NetworkEnv) ?? "testnet";
  const isMainnet = networkEnv === "mainnet";
  const suffix = isMainnet ? "MAINNET" : "TESTNET";

  return {
    networkEnv,
    sourceChain: {
      rpcUrl: isMainnet ? requireEnv("ETHEREUM_MAINNET_RPC_URL") : requireEnv("SEPOLIA_RPC_URL"),
      wsRpcUrl: isMainnet
        ? optionalEnv("ETHEREUM_MAINNET_WSS_RPC_URL")
        : optionalEnv("SEPOLIA_WSS_RPC_URL"),
      chainKey: Number(optionalEnv(`SOURCE_CHAIN_KEY_${isMainnet ? "MAINNET" : "TESTNET"}`, "1")),
      remittanceTokenAddress: requireEnv(`SOURCE_REMITTANCE_TOKEN_ADDRESS_${suffix}`),
    },
    creditcoin: {
      rpcUrl: requireEnv(`CC3_${suffix}_RPC_URL`),
      chainId: Number(requireEnv(`CC3_${suffix}_CHAIN_ID`)),
    },
    usc: {
      proverApiUrl: requireEnv(`USC_PROVER_API_URL_${suffix}`),
      precompileAddress: optionalEnv(
        "ATTESTCOIN_BLOCK_PROVER_PRECOMPILE_ADDRESS",
        "0x0000000000000000000000000000000000000FD2"
      ),
    },
    contracts: {
      remittanceMicroLoan: requireEnv(`REMITTANCE_MICRO_LOAN_ADDRESS_${suffix}`),
      creditRegistry: requireEnv(`CREDIT_REGISTRY_ADDRESS_${suffix}`),
      creditDecisionEngine: requireEnv(`CREDIT_DECISION_ENGINE_ADDRESS_${suffix}`),
      loanStablecoin: requireEnv(`LOAN_STABLECOIN_ADDRESS_${suffix}`),
    },
    worker: {
      privateKey: requireEnv("WORKER_PRIVATE_KEY"),
      pollIntervalMs: Number(optionalEnv("WORKER_POLL_INTERVAL_MS", "15000")),
    },
    backend: {
      port: Number(optionalEnv("PORT", "4000")),
      relayerPrivateKey: optionalEnv("BACKEND_RELAYER_PRIVATE_KEY", ""),
    },
  };
}