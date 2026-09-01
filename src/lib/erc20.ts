// src/lib/erc20.ts
//
// The loan token/contract addresses live server-side in shared/config.ts
// (LOAN_STABLECOIN_ADDRESS_TESTNET etc.) for the backend/worker's signer.
// The frontend needs them too now, to let the user's own wallet call
// approve() directly — but only NEXT_PUBLIC_-prefixed env vars are ever
// sent to the browser in Next.js, so these are separate, public copies of
// the same addresses. Set them in .env.local (and in Vercel's env vars)
// to the same values as their server-side counterparts.

export const LOAN_STABLECOIN_ADDRESS = process.env.NEXT_PUBLIC_LOAN_STABLECOIN_ADDRESS as `0x${string}`;
export const REMITTANCE_MICRO_LOAN_ADDRESS = process.env.NEXT_PUBLIC_REMITTANCE_MICRO_LOAN_ADDRESS as `0x${string}`;

// Just the pieces the frontend needs — allowance/approve/decimals/balanceOf.
// Deliberately not importing shared/abi's full ERC20_ABI: that lives in the
// backend/worker package and isn't meant to ship to the browser bundle.
export const ERC20_MIN_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;