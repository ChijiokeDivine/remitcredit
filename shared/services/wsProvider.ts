// shared/services/wsProvider.ts
//
// ethers v6's WebSocketProvider does not reconnect on its own — if the
// underlying socket drops (network blip, RPC provider restart, idle
// timeout), the provider just goes quiet and every subscription on it
// dies silently. For a long-lived process like the worker, that's not
// acceptable, so this wraps creation + reconnection behind a small API:
// callers register a `resubscribe` callback that re-attaches whatever
// event listeners they need, and this module re-invokes it every time a
// fresh socket comes up.
//
// Node.js has no built-in WebSocket implementation prior to v22, so this
// uses the `ws` package explicitly rather than relying on a global.
import { WebSocketProvider } from "ethers";
import WebSocket from "ws";

export interface ResilientWebSocketProvider {
  /// Current live provider — re-read this after any reconnect rather than
  /// caching it, since the underlying instance changes on reconnect.
  getProvider: () => WebSocketProvider;
  /// Stop reconnecting and close the current socket. Call on shutdown.
  close: () => void;
}

export interface WebSocketProviderOptions {
  /// Called once right after every successful connection (including the
  /// first). Re-attach Contract listeners / filters here — a Contract
  /// bound to the old provider stops receiving events once that socket
  /// is gone, so it must be rebuilt against the new provider each time.
  onConnect: (provider: WebSocketProvider) => void;
  /// Called when the socket closes/errors, before a reconnect attempt.
  onDisconnect?: (error?: Error) => void;
  /// Base delay before the first reconnect attempt; doubles each retry
  /// up to maxBackoffMs. Default 1000ms.
  initialBackoffMs?: number;
  /// Reconnect backoff ceiling. Default 30000ms.
  maxBackoffMs?: number;
}

export function createResilientWebSocketProvider(
  wsUrl: string,
  options: WebSocketProviderOptions
): ResilientWebSocketProvider {
  const initialBackoffMs = options.initialBackoffMs ?? 1000;
  const maxBackoffMs = options.maxBackoffMs ?? 30000;

  let current: WebSocketProvider | undefined;
  let closedByCaller = false;
  let backoffMs = initialBackoffMs;

  function connect(): void {
    if (closedByCaller) return;

    const socket = new WebSocket(wsUrl);
    // ethers' WebSocketLike type just needs on/send/close, which `ws`
    // satisfies — cast through `any` rather than a misleading string cast.
    const provider = new WebSocketProvider(socket as any);
    current = provider;

    socket.on("open", () => {
      backoffMs = initialBackoffMs; // reset backoff on a healthy connection
      console.log(`[ws-provider] connected to ${redact(wsUrl)}`);
      options.onConnect(provider);
    });

    socket.on("close", (code: number) => {
      options.onDisconnect?.(new Error(`WebSocket closed (code ${code})`));
      if (closedByCaller) return;
      console.warn(`[ws-provider] disconnected (code ${code}); reconnecting in ${backoffMs}ms`);
      scheduleReconnect();
    });

    socket.on("error", (error: Error) => {
      console.error("[ws-provider] socket error:", error.message);
      // "close" fires after "error" for terminal failures, so reconnect
      // scheduling happens there — avoid double-scheduling here.
    });
  }

  function scheduleReconnect(): void {
    setTimeout(() => {
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
      connect();
    }, backoffMs);
  }

  connect();

  return {
    getProvider: () => {
      if (!current) throw new Error("WebSocket provider not yet connected");
      return current;
    },
    close: () => {
      closedByCaller = true;
      current?.destroy();
    },
  };
}

function redact(url: string): string {
  // Avoid logging API keys that are commonly embedded in RPC URLs
  // (e.g. wss://.../v3/<key>).
  return url.replace(/\/[a-zA-Z0-9_-]{20,}(\/?)$/, "/***$1");
}