// shared/services/contractClient.ts
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  TransactionResponse,
  formatUnits,
} from "ethers";
import { RemitCreditConfig } from "../config";
import {
  REMITTANCE_MICRO_LOAN_ABI,
  REMITTANCE_CREDIT_REGISTRY_ABI,
  CREDIT_DECISION_ENGINE_ABI,
  ERC20_ABI,
} from "../abi";
import {
  BorrowerRecord,
  RemittanceProofData,
  RemittanceStatsView,
  VerifiedTransferRecord,
} from "../types";
import {
  encodeMerkleProofForContract,
  encodeContinuityProofForContract,
  encodeTxBytesForContract,
} from "./proofEncoding";

/**
 * A contract revert whose custom error was successfully decoded against one
 * of our known ABIs (loan / registry / engine). Thrown in place of the raw
 * ethers error by every write method below, so callers (e.g. API routes)
 * can branch on `errorName` instead of string-matching `err.message` —
 * which doesn't work when ethers reports "unknown custom error" for
 * reverts surfaced during gas estimation.
 */
export class ContractCallError extends Error {
  constructor(
    public readonly errorName: string,
    public readonly args: unknown[],
    public readonly raw: unknown
  ) {
    super(`${errorName}(${args.map(String).join(", ")})`);
    this.name = "ContractCallError";
  }
}

export class RemitCreditClient {
  readonly provider: JsonRpcProvider;
  readonly signer?: Wallet;

  readonly loan: Contract;
  readonly registry: Contract;
  readonly engine: Contract;
  readonly loanToken: Contract;

  constructor(config: RemitCreditConfig, privateKey?: string) {
    this.provider = new JsonRpcProvider(config.creditcoin.rpcUrl);
    this.signer = privateKey ? new Wallet(privateKey, this.provider) : undefined;

    const runner = this.signer ?? this.provider;
    this.loan = new Contract(
      config.contracts.remittanceMicroLoan,
      REMITTANCE_MICRO_LOAN_ABI,
      runner
    );
    this.registry = new Contract(
      config.contracts.creditRegistry,
      REMITTANCE_CREDIT_REGISTRY_ABI,
      runner
    );
    this.engine = new Contract(
      config.contracts.creditDecisionEngine,
      CREDIT_DECISION_ENGINE_ABI,
      runner
    );
    this.loanToken = new Contract(
      config.contracts.loanStablecoin,
      ERC20_ABI,
      runner
    );
  }

  private requireSigner(): Wallet {
    if (!this.signer) {
      throw new Error("This RemitCreditClient was constructed without a signer");
    }
    return this.signer;
  }

  /**
   * Try to decode a thrown error's revert data as a custom error against
   * every contract interface we know about. Returns null if the error
   * data isn't present or doesn't match any known custom error (e.g. a
   * plain require() string revert, or a non-contract error like a network
   * failure) — callers should fall back to rethrowing the original error
   * in that case.
   */
  private decodeError(err: unknown): ContractCallError | null {
    const anyErr = err as any;
    const data: unknown =
      anyErr?.data ?? anyErr?.info?.error?.data ?? anyErr?.error?.data;
    if (typeof data !== "string" || !data.startsWith("0x")) return null;

    for (const contract of [this.loan, this.registry, this.engine]) {
      try {
        const parsed = contract.interface.parseError(data);
        if (parsed) return new ContractCallError(parsed.name, [...parsed.args], err);
      } catch {
        // Data didn't match this contract's error selectors — try the next one.
      }
    }
    return null;
  }

  /**
   * Run a write call, rethrowing decoded custom errors as ContractCallError
   * so API routes can map them to sensible HTTP statuses instead of a
   * generic 500. If the error can't be decoded, the original error is
   * rethrown unchanged.
   */
  private async sendWrite<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw this.decodeError(err) ?? err;
    }
  }

  async getBorrower(address: string): Promise<BorrowerRecord> {
    const b = await this.loan.getBorrower(address);

    let senders: string[] = [];
    try {
      const list: string[] = await this.loan.getDeclaredSenders(address);
      senders = (list ?? []).filter(
        (a) =>
          typeof a === "string" &&
          a !== "0x0000000000000000000000000000000000000000"
      );
    } catch {
      senders = [];
    }

    return {
      address,
      declaredSenders: senders,
      registered: Boolean(b.registered),
      eligible: Boolean(b.eligible),
      creditLimit: b.creditLimit.toString(),
      riskScoreBps: Number(b.riskScoreBps),
      outstandingPrincipal: b.outstandingPrincipal.toString(),
      lastReviewedAt: Number(b.lastReviewedAt),
    };
  }

  async getDeclaredSenders(borrower: string): Promise<string[]> {
    const list: string[] = await this.loan.getDeclaredSenders(borrower);
    return (list ?? []).filter(
      (a) =>
        typeof a === "string" &&
        a !== "0x0000000000000000000000000000000000000000"
    );
  }

  async isDeclaredSender(borrower: string, sender: string): Promise<boolean> {
    return Boolean(await this.loan.isDeclaredSender(borrower, sender));
  }

  async getAvailableCredit(address: string): Promise<string> {
    return (await this.loan.availableCredit(address)).toString();
  }

  async getRelayer(): Promise<string> {
    return this.loan.relayer();
  }

  async getVerifiedTransfers(
    borrower: string
  ): Promise<VerifiedTransferRecord[]> {
    const transfers = await this.registry.getTransfers(borrower);
    return transfers.map((t: any) => ({
      borrower,
      sender: t.sender,
      amount: t.amount.toString(),
      sourceTimestamp: Number(t.sourceTimestamp),
      sourceTxHash: t.sourceTxHash,
      recordedAt: Number(t.recordedAt),
    }));
  }

  async getStats(
    borrower: string,
    lookbackWindowSeconds: number
  ): Promise<RemittanceStatsView> {
    const s = await this.registry.getStats(borrower, lookbackWindowSeconds);
    return {
      transferCount: Number(s.transferCount),
      totalAmount: s.totalAmount.toString(),
      firstTimestamp: Number(s.firstTimestamp),
      lastTimestamp: Number(s.lastTimestamp),
      avgIntervalSeconds: Number(s.avgIntervalSeconds),
      intervalConsistencyBps: Number(s.intervalConsistencyBps),
    };
  }

  async isTransferRecorded(sourceTxHash: string): Promise<boolean> {
    return this.registry.isTransferRecorded(sourceTxHash);
  }

  async loanTokenDecimals(): Promise<number> {
    return Number(await this.loanToken.decimals());
  }

  async formatLoanAmount(rawAmount: string): Promise<string> {
    return formatUnits(rawAmount, await this.loanTokenDecimals());
  }

  async registerBorrower(
    borrower: string,
    declaredSender: string
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.registerBorrower(borrower, declaredSender));
  }

  async addDeclaredSender(
    borrower: string,
    sender: string
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.addDeclaredSender(borrower, sender));
  }

  async removeDeclaredSender(
    borrower: string,
    sender: string
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.removeDeclaredSender(borrower, sender));
  }

  async submitRemittanceProof(
    borrower: string,
    proof: RemittanceProofData,
    claimedSender: string,
    claimedAmount: string,
    claimedTimestamp: number
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() =>
      contract.submitRemittanceProof(
        borrower,
        proof.chainKey,
        proof.blockHeight,
        encodeTxBytesForContract(proof.txBytes),
        encodeMerkleProofForContract(proof.merkleProof),
        encodeContinuityProofForContract(proof.continuityProof),
        claimedSender,
        claimedAmount,
        claimedTimestamp,
        proof.sourceTxHash
      )
    );
  }

  async requestCreditReview(borrower: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.requestCreditReview(borrower));
  }

  async requestLoan(
    borrower: string,
    amount: string
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.requestLoan(borrower, amount));
  }

  async repay(borrower: string, amount: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return this.sendWrite(() => contract.repay(borrower, amount));
  }
}