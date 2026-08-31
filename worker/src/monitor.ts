// worker/src/monitor.ts
import { Contract, JsonRpcProvider, Provider, Log, EventLog } from "ethers";
import { RemitCreditConfig } from "../../shared/config";
import { RemitCreditClient } from "../../shared/services/contractClient";
import { ERC20_ABI } from "../../shared/abi";
import { createResilientWebSocketProvider, ResilientWebSocketProvider } from "../../shared/services/wsProvider";
import { submitRemittanceProofForTx, AlreadyRecordedError } from "./submitProof";

export interface MonitorOptions {
  onSubmitted?: (result: { borrower: string; sourceTxHash: string }) => void;
  onError?: (error: Error, context: { borrower?: string; sourceTxHash?: string }) => void;
}

/// Keeps an in-memory map of borrower -> declared remittance senders,
/// hydrated from BorrowerRegistered/DeclaredSenderAdded/Removed events on
/// Creditcoin, and watches the source chain's remittance token for
/// Transfer events matching a known (sender, borrower) pair. On a match,
/// it runs the full prove-and-submit pipeline. This is the "Oracle Worker"
/// component the Attestcoin architecture calls out as monitoring events
/// and auto-generating proofs.
///
/// Transport: if `config.sourceChain.wsRpcUrl` is set, this subscribes
/// over a persistent WebSocket (near-instant detection, push-based). If
/// not, it falls back to HTTP polling via `rpcUrl` (ethers polls
/// eth_getFilterChanges/getLogs under the hood on a fixed interval) —
/// works everywhere, including RPC providers that don't offer a `wss://`
/// endpoint, but detection latency is bounded by ethers' poll interval
/// rather than pushed the instant a block lands.
export class RemittanceMonitor {
  private readonly config: RemitCreditConfig;
  private readonly client: RemitCreditClient;
  private readonly options: MonitorOptions;

  private wsHandle?: ResilientWebSocketProvider;
  private httpProvider?: JsonRpcProvider;
  private activeContract?: Contract;

  // declaredSender (lowercase) -> Set of borrower addresses that named it
  private senderToBorrowers = new Map<string, Set<string>>();

  constructor(config: RemitCreditConfig, client: RemitCreditClient, options: MonitorOptions = {}) {
    this.config = config;
    this.client = client;
    this.options = options;
  }

  async start(): Promise<void> {
    await this.hydrateBorrowerRegistry();

    // Keep the registry fresh as borrowers register or add/remove senders.
    // This listens on the Creditcoin side (via the client's own provider),
    // independent of the source-chain transport chosen below.
    this.client.loan.on("BorrowerRegistered", (borrower: string, initialSenders: string[]) => {
      for (const sender of initialSenders) this.addBorrower(borrower, sender);
    });
    this.client.loan.on("DeclaredSenderAdded", (borrower: string, sender: string) => {
      this.addBorrower(borrower, sender);
    });
    this.client.loan.on("DeclaredSenderRemoved", (borrower: string, sender: string) => {
      this.removeBorrower(borrower, sender);
    });

    if (this.config.sourceChain.wsRpcUrl) {
      this.startWebSocket(this.config.sourceChain.wsRpcUrl);
    } else {
      console.log(
        "[monitor] no wsRpcUrl configured — falling back to HTTP polling. " +
          "Set SEPOLIA_WSS_RPC_URL / ETHEREUM_MAINNET_WSS_RPC_URL for instant detection."
      );
      this.startHttpPolling();
    }
  }

  stop(): void {
    this.activeContract?.removeAllListeners("Transfer");
    this.wsHandle?.close();
    this.client.loan.removeAllListeners("BorrowerRegistered");
    this.client.loan.removeAllListeners("DeclaredSenderAdded");
    this.client.loan.removeAllListeners("DeclaredSenderRemoved");
  }

  private startWebSocket(wsUrl: string): void {
    this.wsHandle = createResilientWebSocketProvider(wsUrl, {
      onConnect: (provider) => {
        // A dropped-then-reconnected socket means a brand new provider —
        // any Contract/listener bound to the old one is dead, so rebuild
        // and re-attach rather than assuming the old subscription survived.
        this.activeContract?.removeAllListeners("Transfer");
        this.activeContract = this.buildRemittanceTokenContract(provider);
        this.attachTransferListener(this.activeContract);
        console.log(
          `[monitor] watching ${this.config.sourceChain.remittanceTokenAddress} over WebSocket for remittances to ${this.senderToBorrowers.size} known sender(s)`
        );
      },
      onDisconnect: (error) => {
        this.options.onError?.(error ?? new Error("WebSocket disconnected"), {});
      },
    });
  }

  private startHttpPolling(): void {
    this.httpProvider = new JsonRpcProvider(this.config.sourceChain.rpcUrl);
    this.activeContract = this.buildRemittanceTokenContract(this.httpProvider);
    this.attachTransferListener(this.activeContract);
    console.log(
      `[monitor] watching ${this.config.sourceChain.remittanceTokenAddress} via HTTP polling for remittances to ${this.senderToBorrowers.size} known sender(s)`
    );
  }

  private buildRemittanceTokenContract(provider: Provider): Contract {
    return new Contract(this.config.sourceChain.remittanceTokenAddress, ERC20_ABI, provider);
  }

  private attachTransferListener(contract: Contract): void {
    contract.on("Transfer", async (from: string, to: string, _value: bigint, event: EventLog | Log) => {
      const senderKey = from.toLowerCase();
      const borrowers = this.senderToBorrowers.get(senderKey);
      if (!borrowers || !borrowers.has(to.toLowerCase())) return; // not a tracked remittance

      const txHash: string = (event as EventLog | Log).transactionHash;

      try {
        const result = await submitRemittanceProofForTx(this.config, this.client, to, txHash);
        this.options.onSubmitted?.({ borrower: to, sourceTxHash: txHash });
        console.log(
          `[monitor] recorded remittance ${txHash} for borrower ${to} (onchain tx ${result.onchainTxHash})`
        );
      } catch (error) {
        if (error instanceof AlreadyRecordedError) return; // benign, already handled
        this.options.onError?.(error as Error, { borrower: to, sourceTxHash: txHash });
        console.error(`[monitor] failed to process remittance ${txHash} for ${to}:`, error);
      }
    });
  }

  private async hydrateBorrowerRegistry(): Promise<void> {
    // Replay history in order: registrations first, then every add/remove,
    // sorted by block so a later removal correctly overrides an earlier add.
    const [registeredEvents, addedEvents, removedEvents] = await Promise.all([
      this.client.loan.queryFilter(this.client.loan.filters.BorrowerRegistered(), 0, "latest"),
      this.client.loan.queryFilter(this.client.loan.filters.DeclaredSenderAdded(), 0, "latest"),
      this.client.loan.queryFilter(this.client.loan.filters.DeclaredSenderRemoved(), 0, "latest"),
    ]);

    type Change = { blockNumber: number; logIndex: number; borrower: string; sender: string; add: boolean };
    const changes: Change[] = [];

    for (const event of registeredEvents) {
      if (!("args" in event) || !event.args) continue;
      const [borrower, initialSenders] = event.args as unknown as [string, string[]];
      for (const sender of initialSenders) {
        changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: true });
      }
    }
    for (const event of addedEvents) {
      if (!("args" in event) || !event.args) continue;
      const [borrower, sender] = event.args as unknown as [string, string];
      changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: true });
    }
    for (const event of removedEvents) {
      if (!("args" in event) || !event.args) continue;
      const [borrower, sender] = event.args as unknown as [string, string];
      changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: false });
    }

    changes.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    for (const change of changes) {
      if (change.add) this.addBorrower(change.borrower, change.sender);
      else this.removeBorrower(change.borrower, change.sender);
    }
  }

  private addBorrower(borrower: string, declaredSender: string): void {
    const key = declaredSender.toLowerCase();
    const set = this.senderToBorrowers.get(key) ?? new Set<string>();
    set.add(borrower.toLowerCase());
    this.senderToBorrowers.set(key, set);
  }

  private removeBorrower(borrower: string, declaredSender: string): void {
    const key = declaredSender.toLowerCase();
    const set = this.senderToBorrowers.get(key);
    set?.delete(borrower.toLowerCase());
  }
}