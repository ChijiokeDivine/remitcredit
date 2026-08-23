// src/lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, mainnet } from "wagmi/chains";
import { type Chain } from "viem";

export const creditcoinTestnet: Chain = {
  id: 102031,
  name: "Creditcoin Testnet",
  nativeCurrency: { name: "CTC", symbol: "CTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.cc3-testnet.creditcoin.network"] },
  },
  blockExplorers: {
    default: {
      name: "Creditcoin Explorer",
      url: "https://creditcoin-testnet.blockscout.com",
    },
  },
  testnet: true,
};

export const creditcoinMainnet: Chain = {
  id: 102030,
  name: "Creditcoin",
  nativeCurrency: { name: "CTC", symbol: "CTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_CC3_MAINNET_RPC_URL ||
          "https://mainnet3.creditcoin.network",
      ],
    },
  },
  testnet: false,
};

const projectId =
  process.env.NEXT_PUBLIC_RAINBOW_KIT_APP_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "";

export const wagmiConfig = getDefaultConfig({
  appName: "RemitCredit",
  projectId: projectId || "00000000000000000000000000000000",
  chains: [creditcoinTestnet, sepolia, creditcoinMainnet, mainnet],
  ssr: true,
});