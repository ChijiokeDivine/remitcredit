// src/components/providers.tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

function RainbowKitWithTheme({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <RainbowKitProvider
      theme={resolvedTheme === "dark" ? darkTheme() : lightTheme()}
      modalSize="compact"
      appInfo={{ appName: "RemitCredit" }}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RainbowKitWithTheme>{children}</RainbowKitWithTheme>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}