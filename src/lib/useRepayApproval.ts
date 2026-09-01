// src/lib/useRepayApproval.ts
"use client";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ERC20_MIN_ABI, LOAN_STABLECOIN_ADDRESS, REMITTANCE_MICRO_LOAN_ADDRESS } from "./erc20";

/**
 * repay() pulls tokens out of the borrower's own wallet via transferFrom,
 * which only works once the borrower has personally approved the loan
 * contract as a spender — that's an ERC-20 rule, not something a relayer
 * can do on their behalf. This hook handles that one user-signed step;
 * everything else in the app stays on the relayer/gasless path.
 */
export function useRepayApproval() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Two distinct waiting phases, exposed separately so the UI can say the
  // right thing: "isSigning" = waiting on the wallet popup, "isConfirming"
  // = the tx was submitted and we're waiting for it to land on-chain.
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: LOAN_STABLECOIN_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: address ? [address, REMITTANCE_MICRO_LOAN_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: decimals } = useReadContract({
    address: LOAN_STABLECOIN_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: "decimals",
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
   * then blocks until that transaction is actually mined — not just sent.
   *
   * That wait is the fix for the "not approved enough allowance" error
   * that showed up even right after approving: writeContractAsync resolves
   * once the wallet has *submitted* the transaction, not once it's
   * confirmed. Without waiting here, the caller's next step (repay, via
   * the relayer) can reach the contract before the approval has actually
   * landed on-chain, and the allowance check correctly still sees 0.
   */
  const approve = useCallback(async () => {
    const hash = await writeContractAsync({
      address: LOAN_STABLECOIN_ADDRESS,
      abi: ERC20_MIN_ABI,
      functionName: "approve",
      args: [REMITTANCE_MICRO_LOAN_ADDRESS, 2n ** 256n - 1n],
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
    refetchAllowance,
  };
}