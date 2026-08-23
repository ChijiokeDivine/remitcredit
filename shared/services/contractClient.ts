// shared/services/contractClient.ts
import { Contract, JsonRpcProvider, Wallet, TransactionResponse, formatUnits } from "ethers";
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

/// Wraps the three RemitCredit contracts behind typed, promise-based
/// methods. Constructed once per process (worker or backend) with either a
/// read-only provider or a signing wallet, depending on whether that
/// process needs to submit transactions.
///
/// NOTE: registerBorrower / addDeclaredSender / removeDeclaredSender /
/// requestLoan / repay are relayer-gated on-chain (onlyRelayer) and take an
/// explicit `borrower` param — the signer wallet here is *only* the relayer
/// paying gas and authorizing the call, never the on-chain borrower
/// identity itself. Always pass the real borrower address explicitly.
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
    this.loan = new Contract(config.contracts.remittanceMicroLoan, REMITTANCE_MICRO_LOAN_ABI, runner);
    this.registry = new Contract(config.contracts.creditRegistry, REMITTANCE_CREDIT_REGISTRY_ABI, runner);
    this.engine = new Contract(config.contracts.creditDecisionEngine, CREDIT_DECISION_ENGINE_ABI, runner);
    this.loanToken = new Contract(config.contracts.loanStablecoin, ERC20_ABI, runner);
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("This RemitCreditClient was constructed without a signer");
    return this.signer;
  }

  // ── Reads ────────────────────────────────────────────────────────

  async getBorrower(address: string): Promise<BorrowerRecord> {
    const [b, declaredSenders] = await Promise.all([
      this.loan.getBorrower(address),
      this.loan.getDeclaredSenders(address),
    ]);
    return {
      address,
      declaredSenders,
      registered: b.registered,
      eligible: b.eligible,
      creditLimit: b.creditLimit.toString(),
      riskScoreBps: Number(b.riskScoreBps),
      outstandingPrincipal: b.outstandingPrincipal.toString(),
      lastReviewedAt: Number(b.lastReviewedAt),
    };
  }

  async getDeclaredSenders(borrower: string): Promise<string[]> {
    return this.loan.getDeclaredSenders(borrower);
  }

  async isDeclaredSender(borrower: string, sender: string): Promise<boolean> {
    return this.loan.isDeclaredSender(borrower, sender);
  }

  async getAvailableCredit(address: string): Promise<string> {
    const value = await this.loan.availableCredit(address);
    return value.toString();
  }

  async getVerifiedTransfers(borrower: string): Promise<VerifiedTransferRecord[]> {
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

  async getStats(borrower: string, lookbackWindowSeconds: number): Promise<RemittanceStatsView> {
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
    const decimals = await this.loanTokenDecimals();
    return formatUnits(rawAmount, decimals);
  }

  // ── Writes (require a signer authorized as the on-chain `relayer`) ──

  async registerBorrower(borrower: string, declaredSender: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.registerBorrower(borrower, declaredSender);
  }

  async addDeclaredSender(borrower: string, sender: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.addDeclaredSender(borrower, sender);
  }

  async removeDeclaredSender(borrower: string, sender: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.removeDeclaredSender(borrower, sender);
  }

  async submitRemittanceProof(
    borrower: string,
    proof: RemittanceProofData,
    claimedSender: string,
    claimedAmount: string,
    claimedTimestamp: number
  ): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.submitRemittanceProof(
      borrower,
      proof.chainKey,
      proof.blockHeight,
      proof.txBytes,
      proof.merkleProof,
      proof.continuityProof,
      claimedSender,
      claimedAmount,
      claimedTimestamp,
      proof.sourceTxHash
    );
  }

  async requestCreditReview(borrower: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.requestCreditReview(borrower);
  }

  async requestLoan(borrower: string, amount: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.requestLoan(borrower, amount);
  }

  async repay(borrower: string, amount: string): Promise<TransactionResponse> {
    const contract = this.loan.connect(this.requireSigner()) as Contract;
    return contract.repay(borrower, amount);
  }
}
