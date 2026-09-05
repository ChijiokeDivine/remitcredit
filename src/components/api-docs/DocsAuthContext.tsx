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
import { useAccount, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { API_BASE } from "@/lib/api-docs/registry";

type DocsAuth = {
  address: string | null;
  isConnected: boolean;
  sessionToken: string | null;
  sessionAddress: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  connectWallet: () => void;
  signInWithSiwe: () => Promise<string | null>;
  setSessionToken: (token: string | null) => void;
  clearSession: () => void;
};

const Ctx = createContext<DocsAuth | null>(null);
const STORAGE_KEY = "remitcredit_docs_session_v1";

export function DocsAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signMessageAsync } = useSignMessage();
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { token: string; address: string; expiresAt?: string };
      if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setSessionTokenState(parsed.token);
      setSessionAddress(parsed.address);
    } catch {
      /* ignore */
    }
  }, []);

  const setSessionToken = useCallback((token: string | null, addr?: string, expiresAt?: string) => {
    setSessionTokenState(token);
    if (token && addr) {
      setSessionAddress(addr);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, address: addr, expiresAt }));
    } else {
      setSessionAddress(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearSession = useCallback(() => {
    setSessionToken(null);
    setAuthError(null);
  }, [setSessionToken]);

  const connectWallet = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const signInWithSiwe = useCallback(async (): Promise<string | null> => {
    setAuthError(null);
    if (!address) {
      openConnectModal?.();
      setAuthError("Connect a wallet first.");
      return null;
    }
    setIsAuthenticating(true);
    try {
      const chRes = await fetch(`${API_BASE}/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const ch = await chRes.json();
      if (!chRes.ok) {
        throw new Error(ch?.error?.message || ch?.error || "Challenge failed");
      }
      const signature = await signMessageAsync({ message: ch.message });
      const vRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: ch.message, signature }),
      });
      const session = await vRes.json();
      if (!vRes.ok) {
        throw new Error(session?.error?.message || session?.error || "Verify failed");
      }
      setSessionToken(session.token, session.address, session.expiresAt);
      return session.token as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setAuthError(msg);
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, openConnectModal, signMessageAsync, setSessionToken]);

  const value = useMemo(
    () => ({
      address: address ?? null,
      isConnected,
      sessionToken,
      sessionAddress,
      isAuthenticating,
      authError,
      connectWallet,
      signInWithSiwe,
      setSessionToken: (t: string | null) => setSessionToken(t),
      clearSession,
    }),
    [
      address,
      isConnected,
      sessionToken,
      sessionAddress,
      isAuthenticating,
      authError,
      connectWallet,
      signInWithSiwe,
      setSessionToken,
      clearSession,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocsAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDocsAuth must be used within DocsAuthProvider");
  return v;
}
