// src/lib/useRepayApproval.ts
"use client";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { creditcoinTestnet } from "@/lib/wagmi";
import { ERC20_MIN_ABI, LOAN_STABLECOIN_ADDRESS, REMITTANCE_MICRO_LOAN_ADDRESS } from "./erc20";

/**
 * repay() pulls tokens out of the borrower's own wallet via transferFrom,
 * which only works once the borrower has personally approved the loan
 * contract as a spender — that's an ERC-20 rule, not something a relayer
 * can do on their behalf. This hook handles that one user-signed step;
 * everything else in the app stays on the relayer/gasless path.
 *
 * Everything below is explicitly pinned to Creditcoin testnet via
 * `chainId: creditcoinTestnet.id`. Without that, wagmi sends the write (and
 * reads the allowance) against whatever chain the wallet's connector
 * currently happens to be on — if that's not Creditcoin, the approve can
 * succeed for real, just against a token/contract pair on the wrong chain,
 * which the relayer's on-chain allowance check will never see. Passing
 * `chainId` here also makes wagmi prompt a chain switch first if needed,
 * instead of silently using the wrong one.
 */
export function useRepayApproval() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: creditcoinTestnet.id });

  // Two distinct waiting phases, exposed separately so the UI can say the
  // right thing: "isSigning" = waiting on the wallet popup, "isConfirming"
  // = the tx was submitted and we're waiting for it to land on-chain.
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: LOAN_STABLECOIN_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: address ? [address, REMITTANCE_MICRO_LOAN_ADDRESS] : undefined,
    chainId: creditcoinTestnet.id,
    query: { enabled: Boolean(address && LOAN_STABLECOIN_ADDRESS && REMITTANCE_MICRO_LOAN_ADDRESS) },
  });

  const { data: decimals } = useReadContract({
    address: LOAN_STABLECOIN_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: "decimals",
    chainId: creditcoinTestnet.id,
    query: { enabled: Boolean(LOAN_STABLECOIN_ADDRESS) },
  });

  const { writeContractAsync, isPending: isSigning } = useWriteContract();

  /** True if the current allowance is below `amountBaseUnits`. */
  const needsApproval = useCallback(
    (amountBaseUnits: bigint) => (allowance ?? 0n) < amountBaseUnits,
    [allowance]
  );

  /**
   * Prompts the user's wallet to sign approve() for an unlimited amount
   * (so this only has to happen once ever, not before every repayment),
   * then blocks until that transaction is actually mined on Creditcoin
   * testnet specifically — not just sent, and not on whatever chain the
   * wallet happened to be active on. Returns the tx hash so the caller can
   * surface it for independent verification on a block explorer.
   */
  const approve = useCallback(async (): Promise<`0x${string}`> => {
    if (!LOAN_STABLECOIN_ADDRESS || !REMITTANCE_MICRO_LOAN_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_LOAN_STABLECOIN_ADDRESS / NEXT_PUBLIC_REMITTANCE_MICRO_LOAN_ADDRESS aren't set. " +
          "Add them (same values as the server-side LOAN_STABLECOIN_ADDRESS_TESTNET / " +
          "REMITTANCE_MICRO_LOAN_ADDRESS_TESTNET) and restart the dev server — Next.js inlines " +
          "NEXT_PUBLIC_ vars at build/start time, so editing .env.local alone isn't enough."
      );
    }

    const hash = await writeContractAsync({
      address: LOAN_STABLECOIN_ADDRESS,
      abi: ERC20_MIN_ABI,
      functionName: "approve",
      args: [REMITTANCE_MICRO_LOAN_ADDRESS, 2n ** 256n - 1n],
      chainId: creditcoinTestnet.id,
    });

    setIsConfirming(true);
    try {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
    } finally {
      setIsConfirming(false);
    }

    await refetchAllowance();
    return hash;
  }, [writeContractAsync, publicClient, refetchAllowance]);

  return {
    allowance: allowance ?? 0n,
    decimals: decimals ?? 6,
    needsApproval,
    approve,
    isSigning,
    isConfirming,
    isApproving: isSigning || isConfirming,
    tokenConfigured: Boolean(LOAN_STABLECOIN_ADDRESS && REMITTANCE_MICRO_LOAN_ADDRESS),
    refetchAllowance,
  };
}