"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type WalletContextValue = {
  address: string | null;
  isConnecting: boolean;
  /** Connects wallet and returns the active address (or null). */
  connect: () => Promise<string | null>;
  disconnect: () => void;
  setDemoAddress: (addr: string) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const STORAGE_KEY = "remitcredit:wallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAddress(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((addr: string | null) => {
    setAddress(addr);
    try {
      if (addr) localStorage.setItem(STORAGE_KEY, addr);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const connect = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    try {
      const eth = (
        window as unknown as {
          ethereum?: {
            request: (args: { method: string }) => Promise<string[]>;
          };
        }
      ).ethereum;
      if (eth) {
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts?.[0]) {
          persist(accounts[0]);
          return accounts[0];
        }
      }
      // Demo fallback when no injected wallet
      const demo = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";
      persist(demo);
      return demo;
    } finally {
      setIsConnecting(false);
    }
  }, [persist]);

  const disconnect = useCallback(() => persist(null), [persist]);
  const setDemoAddress = useCallback((addr: string) => persist(addr), [persist]);

  const value = useMemo(
    () => ({ address, isConnecting, connect, disconnect, setDemoAddress }),
    [address, isConnecting, connect, disconnect, setDemoAddress]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}