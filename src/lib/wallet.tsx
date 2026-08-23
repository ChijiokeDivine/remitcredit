// src/lib/wallet.tsx
"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { creditcoinTestnet } from "@/lib/wagmi";

export function useWallet() {
  const { address, isConnecting, isReconnecting, isConnected, chainId } =
    useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();

  const connect = useCallback(async (): Promise<string | null> => {
    if (address) return address;
    openConnectModal?.();
    return null;
  }, [address, openConnectModal]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  const ensureCreditcoin = useCallback(async () => {
    if (chainId === creditcoinTestnet.id) return;
    try {
      await switchChainAsync?.({ chainId: creditcoinTestnet.id });
    } catch {
      /* user rejected */
    }
  }, [chainId, switchChainAsync]);

  const setDemoAddress = useCallback((_addr: string) => {
    console.warn("[wallet] setDemoAddress is a no-op with RainbowKit");
  }, []);

  return useMemo(
    () => ({
      address: address ?? null,
      isConnecting: isConnecting || isReconnecting,
      isConnected: !!isConnected,
      chainId,
      connect,
      disconnect,
      ensureCreditcoin,
      setDemoAddress,
    }),
    [
      address,
      isConnecting,
      isReconnecting,
      isConnected,
      chainId,
      connect,
      disconnect,
      ensureCreditcoin,
      setDemoAddress,
    ]
  );
}