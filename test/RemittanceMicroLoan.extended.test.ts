// test/RemittanceMicroLoan.extended.test.ts
//
// Extends the existing RemittanceMicroLoan.test.ts with admin controls,
// pausability, batch proof submission, and loan/repay edge cases.
//
// NOTE: MockAttestcoinBlockProver and MockStablecoin source isn't included
// in what was reviewed here, so this file assumes (matching the naming and
// usage already established in RemittanceMicroLoan.test.ts):
//   - prover.setVerified(encodedTxBytes, bool) marks a specific encodedTx as
//     verified/unverified for both verify() and verifyBatch().
//   - verifyBatch(...) returns true only if every encodedTx in the batch has
//     been marked verified.
//   - MockStablecoin exposes a standard ERC20 interface plus mint(to, amount).
// If the actual mocks differ (e.g. verifyBatch keys off a single hash, or
// setVerified takes a hash instead of raw bytes), adjust submitBatch() below
// accordingly — everything downstream of it doesn't depend on that detail.
import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RemitCredit — RemittanceMicroLoan (extended)", () => {
  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let familySender: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let prover: any;
  let registry: any;
  let engine: any;
  let token: any;
  let loan: any;

  const DAY = 24 * 60 * 60;

  const defaultParams = {
    minTransferCount: 3,
    minTotalAmount: ethers.parseUnits("300", 6),
    minConsistencyBps: 5000,
    creditMultiplierBps: 3000,
    maxCreditLimit: ethers.parseUnits("1000", 6),
    lookbackWindowSeconds: 180 * DAY,
    maxStalenessSeconds: 60 * DAY,
  };

  beforeEach(async () => {
    [owner, borrower, familySender, other] = await ethers.getSigners();

    const Prover = await ethers.getContractFactory("MockAttestcoinBlockProver");
    prover = await Prover.deploy(owner.address);

    const Registry = await ethers.getContractFactory("RemittanceCreditRegistry");
    registry = await Registry.deploy(owner.address);

    const Engine = await ethers.getContractFactory("CreditDecisionEngine");
    engine = await Engine.deploy(owner.address, defaultParams);

    const Token = await ethers.getContractFactory("MockStablecoin");
    token = await Token.deploy(owner.address);

    const Loan = await ethers.getContractFactory("RemittanceMicroLoan");
    loan = await Loan.deploy(
      owner.address,
      await prover.getAddress(),
      await registry.getAddress(),
      await engine.getAddress(),
      await token.getAddress()
    );

    await registry.connect(owner).setRecorder(await loan.getAddress());

    await token.connect(owner).mint(owner.address, ethers.parseUnits("10000", 6));
    await token.connect(owner).approve(await loan.getAddress(), ethers.parseUnits("10000", 6));
    await loan.connect(owner).fundPool(ethers.parseUnits("10000", 6));
  });

  async function submitFakeRemittance(amount: bigint, timestamp: number, salt: string) {
    const encodedTx = ethers.toUtf8Bytes(`tx:${salt}`);
    const sourceTxHash = ethers.keccak256(encodedTx);
    await prover.connect(owner).setVerified(encodedTx, true);

    await loan.connect(owner).submitRemittanceProof(
      borrower.address,
      1,
      1_000_000,
      encodedTx,
      "0x",
      "0x",
      familySender.address,
      amount,
      timestamp,
      sourceTxHash
    );
  }

  async function makeEligibleBorrower() {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const now = Math.floor(Date.now() / 1000);
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 60 * DAY, "el-1");
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 30 * DAY, "el-2");
    await submitFakeRemittance(ethers.parseUnits("120", 6), now - 1 * DAY, "el-3");
    await loan.requestCreditReview(borrower.address);
  }

  // ── Admin ──────────────────────────────────────────────────────────

  describe("admin setters", () => {
    it("only the owner can update the precompile address", async () => {
      await expect(loan.connect(other).setPrecompile(other.address)).to.be.revertedWithCustomError(
        loan,
        "OwnableUnauthorizedAccount"
      );
      await expect(loan.connect(owner).setPrecompile(other.address))
        .to.emit(loan, "PrecompileUpdated")
        .withArgs(other.address);
      expect(await loan.precompile()).to.equal(other.address);
    });

    it("only the owner can update the registry address", async () => {
      await expect(loan.connect(other).setRegistry(other.address)).to.be.revertedWithCustomError(
        loan,
        "OwnableUnauthorizedAccount"
      );
      await expect(loan.connect(owner).setRegistry(other.address))
        .to.emit(loan, "RegistryUpdated")
        .withArgs(other.address);
      expect(await loan.registry()).to.equal(other.address);
    });

    it("only the owner can update the credit engine address", async () => {
      await expect(loan.connect(other).setCreditEngine(other.address)).to.be.revertedWithCustomError(
        loan,
        "OwnableUnauthorizedAccount"
      );
      await expect(loan.connect(owner).setCreditEngine(other.address))
        .to.emit(loan, "CreditEngineUpdated")
        .withArgs(other.address);
      expect(await loan.creditEngine()).to.equal(other.address);
    });

    it("only the owner can update the loan token address", async () => {
      await expect(loan.connect(other).setLoanToken(other.address)).to.be.revertedWithCustomError(
        loan,
        "OwnableUnauthorizedAccount"
      );
      await expect(loan.connect(owner).setLoanToken(other.address))
        .to.emit(loan, "LoanTokenUpdated")
        .withArgs(other.address);
      expect(await loan.loanToken()).to.equal(other.address);
    });
  });

  describe("pool funding", () => {
    it("lets anyone fund the pool and emits PoolFunded", async () => {
      await token.connect(owner).mint(other.address, ethers.parseUnits("100", 6));
      await token.connect(other).approve(await loan.getAddress(), ethers.parseUnits("100", 6));
      await expect(loan.connect(other).fundPool(ethers.parseUnits("100", 6)))
        .to.emit(loan, "PoolFunded")
        .withArgs(other.address, ethers.parseUnits("100", 6));
    });

    it("only the owner can withdraw from the pool", async () => {
      await expect(
        loan.connect(other).withdrawPool(other.address, ethers.parseUnits("1", 6))
      ).to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");

      await expect(loan.connect(owner).withdrawPool(other.address, ethers.parseUnits("1", 6)))
        .to.emit(loan, "PoolWithdrawn")
        .withArgs(other.address, ethers.parseUnits("1", 6));
    });
  });

  describe("pausability", () => {
    it("only the owner can pause or unpause", async () => {
      await expect(loan.connect(other).pause()).to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");
      await loan.connect(owner).pause();
      await expect(loan.connect(other).unpause()).to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");
    });

    it("blocks submitRemittanceProof while paused", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      await loan.connect(owner).pause();

      const encodedTx = ethers.toUtf8Bytes("paused-tx");
      const sourceTxHash = ethers.keccak256(encodedTx);
      await prover.connect(owner).setVerified(encodedTx, true);

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProof(
            borrower.address,
            1,
            1,
            encodedTx,
            "0x",
            "0x",
            familySender.address,
            ethers.parseUnits("50", 6),
            1,
            sourceTxHash
          )
      ).to.be.revertedWithCustomError(loan, "EnforcedPause");
    });

    it("blocks requestCreditReview, requestLoan, and repay while paused", async () => {
      await makeEligibleBorrower();
      await loan.connect(owner).pause();

      await expect(loan.requestCreditReview(borrower.address)).to.be.revertedWithCustomError(loan, "EnforcedPause");
      await expect(loan.connect(borrower).requestLoan(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
        loan,
        "EnforcedPause"
      );
      await expect(loan.connect(borrower).repay(ethers.parseUnits("1", 6))).to.be.revertedWithCustomError(
        loan,
        "EnforcedPause"
      );
    });

    it("resumes normal operation after unpause", async () => {
      await makeEligibleBorrower();
      await loan.connect(owner).pause();
      await loan.connect(owner).unpause();

      await expect(loan.connect(borrower).requestLoan(ethers.parseUnits("10", 6))).to.not.be.reverted;
    });

    it("does not block registerBorrower, fundPool, or withdrawPool while paused", async () => {
      await loan.connect(owner).pause();
      await expect(loan.connect(borrower).registerBorrower(familySender.address)).to.not.be.reverted;

      await token.connect(owner).mint(owner.address, ethers.parseUnits("10", 6));
      await token.connect(owner).approve(await loan.getAddress(), ethers.parseUnits("10", 6));
      await expect(loan.connect(owner).fundPool(ethers.parseUnits("10", 6))).to.not.be.reverted;
      await expect(loan.connect(owner).withdrawPool(owner.address, ethers.parseUnits("1", 6))).to.not.be.reverted;
    });
  });

  // ── Borrower / proof lifecycle ───────────────────────────────────────

  describe("registerBorrower", () => {
    it("rejects a second registration from the same borrower", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      await expect(loan.connect(borrower).registerBorrower(other.address)).to.be.revertedWithCustomError(
        loan,
        "AlreadyRegistered"
      );
    });

    it("rejects proof submission for an address that never registered", async () => {
      const encodedTx = ethers.toUtf8Bytes("unregistered");
      const sourceTxHash = ethers.keccak256(encodedTx);
      await prover.connect(owner).setVerified(encodedTx, true);

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProof(
            other.address,
            1,
            1,
            encodedTx,
            "0x",
            "0x",
            familySender.address,
            ethers.parseUnits("50", 6),
            1,
            sourceTxHash
          )
      ).to.be.revertedWithCustomError(loan, "NotRegistered");
    });
  });

  describe("submitRemittanceProof", () => {
    it("rejects a sourceTxHash that doesn't match keccak256(encodedTx)", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      const encodedTx = ethers.toUtf8Bytes("real-tx");
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("some-other-bytes"));
      await prover.connect(owner).setVerified(encodedTx, true);

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProof(
            borrower.address,
            1,
            1,
            encodedTx,
            "0x",
            "0x",
            familySender.address,
            ethers.parseUnits("50", 6),
            1,
            wrongHash
          )
      ).to.be.revertedWithCustomError(loan, "TxHashMismatch");
    });

    it("emits RemittanceVerified and records the transfer in the registry on success", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      const encodedTx = ethers.toUtf8Bytes("good-tx");
      const sourceTxHash = ethers.keccak256(encodedTx);
      await prover.connect(owner).setVerified(encodedTx, true);

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProof(
            borrower.address,
            1,
            1,
            encodedTx,
            "0x",
            "0x",
            familySender.address,
            ethers.parseUnits("50", 6),
            123,
            sourceTxHash
          )
      )
        .to.emit(loan, "RemittanceVerified")
        .withArgs(borrower.address, familySender.address, ethers.parseUnits("50", 6), 123, sourceTxHash);

      expect(await registry.isTransferRecorded(sourceTxHash)).to.equal(true);
    });
  });

  describe("submitRemittanceProofBatch", () => {
    async function buildBatch(entries: { amount: bigint; timestamp: number; salt: string; verified?: boolean }[]) {
      const encodedTxs = entries.map((e) => ethers.toUtf8Bytes(`batch:${e.salt}`));
      const sourceTxHashes = encodedTxs.map((tx) => ethers.keccak256(tx));
      for (let i = 0; i < entries.length; i++) {
        await prover.connect(owner).setVerified(encodedTxs[i], entries[i].verified ?? true);
      }
      return {
        blockHeights: entries.map(() => 1_000_000),
        encodedTxs,
        merkleProofs: entries.map(() => "0x"),
        claimedSenders: entries.map(() => familySender.address),
        claimedAmounts: entries.map((e) => e.amount),
        claimedTimestamps: entries.map((e) => e.timestamp),
        sourceTxHashes,
      };
    }

    it("records every transfer in the batch and emits one RemittanceVerified per entry", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      const now = Math.floor(Date.now() / 1000);
      const batch = await buildBatch([
        { amount: ethers.parseUnits("100", 6), timestamp: now - 20 * DAY, salt: "b1" },
        { amount: ethers.parseUnits("100", 6), timestamp: now - 10 * DAY, salt: "b2" },
      ]);

      const tx = await loan
        .connect(owner)
        .submitRemittanceProofBatch(
          borrower.address,
          1,
          batch.blockHeights,
          batch.encodedTxs,
          batch.merkleProofs,
          "0x",
          batch.claimedSenders,
          batch.claimedAmounts,
          batch.claimedTimestamps,
          batch.sourceTxHashes
        );

      await expect(tx).to.emit(loan, "RemittanceVerified");
      const transfers = await registry.getTransfers(borrower.address);
      expect(transfers.length).to.equal(2);
    });

    it("reverts the entire batch (no partial writes) if any claimed sender doesn't match the declared sender", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      const now = Math.floor(Date.now() / 1000);
      const batch = await buildBatch([
        { amount: ethers.parseUnits("100", 6), timestamp: now - 20 * DAY, salt: "bad1" },
        { amount: ethers.parseUnits("100", 6), timestamp: now - 10 * DAY, salt: "bad2" },
      ]);
      batch.claimedSenders[1] = other.address; // corrupt the second entry

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProofBatch(
            borrower.address,
            1,
            batch.blockHeights,
            batch.encodedTxs,
            batch.merkleProofs,
            "0x",
            batch.claimedSenders,
            batch.claimedAmounts,
            batch.claimedTimestamps,
            batch.sourceTxHashes
          )
      ).to.be.revertedWithCustomError(loan, "SenderNotDeclared");

      expect((await registry.getTransfers(borrower.address)).length).to.equal(0);
    });

    it("reverts if any encodedTx in the batch fails verification", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      const now = Math.floor(Date.now() / 1000);
      const batch = await buildBatch([
        { amount: ethers.parseUnits("100", 6), timestamp: now - 20 * DAY, salt: "unv1", verified: true },
        { amount: ethers.parseUnits("100", 6), timestamp: now - 10 * DAY, salt: "unv2", verified: false },
      ]);

      await expect(
        loan
          .connect(owner)
          .submitRemittanceProofBatch(
            borrower.address,
            1,
            batch.blockHeights,
            batch.encodedTxs,
            batch.merkleProofs,
            "0x",
            batch.claimedSenders,
            batch.claimedAmounts,
            batch.claimedTimestamps,
            batch.sourceTxHashes
          )
      ).to.be.revertedWithCustomError(loan, "ProofNotVerified");
    });
  });

  // ── Loan lifecycle edge cases ────────────────────────────────────────

  describe("requestLoan", () => {
    it("rejects a zero-amount request", async () => {
      await makeEligibleBorrower();
      await expect(loan.connect(borrower).requestLoan(0)).to.be.revertedWithCustomError(loan, "ZeroAmount");
    });

    it("rejects a request from an unregistered address", async () => {
      await expect(loan.connect(other).requestLoan(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
        loan,
        "NotRegistered"
      );
    });

    it("rejects a request exceeding available pool liquidity even when under the credit limit", async () => {
      await makeEligibleBorrower();
      // Drain the pool down to less than the borrower's credit limit (96 mUSD).
      await loan.connect(owner).withdrawPool(owner.address, ethers.parseUnits("9950", 6));
      const poolBalance = await token.balanceOf(await loan.getAddress());
      expect(poolBalance).to.be.lessThan(ethers.parseUnits("96", 6));

      await expect(
        loan.connect(borrower).requestLoan(ethers.parseUnits("96", 6))
      ).to.be.revertedWithCustomError(loan, "InsufficientPoolLiquidity");
    });

    it("emits LoanDisbursed with the running outstanding balance", async () => {
      await makeEligibleBorrower();
      await expect(loan.connect(borrower).requestLoan(ethers.parseUnits("40", 6)))
        .to.emit(loan, "LoanDisbursed")
        .withArgs(borrower.address, ethers.parseUnits("40", 6), ethers.parseUnits("40", 6));
    });

    it("allows drawing up to exactly the remaining available credit across multiple calls", async () => {
      await makeEligibleBorrower(); // creditLimit = 96 mUSD
      await loan.connect(borrower).requestLoan(ethers.parseUnits("50", 6));
      await expect(loan.connect(borrower).requestLoan(ethers.parseUnits("46", 6))).to.not.be.reverted;
      const record = await loan.getBorrower(borrower.address);
      expect(record.outstandingPrincipal).to.equal(ethers.parseUnits("96", 6));
    });
  });

  describe("repay", () => {
    it("rejects a zero-amount repayment", async () => {
      await makeEligibleBorrower();
      await loan.connect(borrower).requestLoan(ethers.parseUnits("10", 6));
      await expect(loan.connect(borrower).repay(0)).to.be.revertedWithCustomError(loan, "ZeroAmount");
    });

    it("rejects repaying more than the outstanding principal", async () => {
      await makeEligibleBorrower();
      await loan.connect(borrower).requestLoan(ethers.parseUnits("10", 6));
      await token.connect(borrower).approve(await loan.getAddress(), ethers.parseUnits("20", 6));

      await expect(
        loan.connect(borrower).repay(ethers.parseUnits("20", 6))
      ).to.be.revertedWithCustomError(loan, "RepayExceedsOutstanding");
    });

    it("rejects a repayment from a borrower who never registered", async () => {
      await expect(loan.connect(other).repay(ethers.parseUnits("1", 6))).to.be.revertedWithCustomError(
        loan,
        "NotRegistered"
      );
    });

    it("emits LoanRepaid with the updated outstanding balance", async () => {
      await makeEligibleBorrower();
      await loan.connect(borrower).requestLoan(ethers.parseUnits("40", 6));
      await token.connect(borrower).approve(await loan.getAddress(), ethers.parseUnits("15", 6));

      await expect(loan.connect(borrower).repay(ethers.parseUnits("15", 6)))
        .to.emit(loan, "LoanRepaid")
        .withArgs(borrower.address, ethers.parseUnits("15", 6), ethers.parseUnits("25", 6));
    });

    it("allows partial repayment followed by drawing the freed-up credit again", async () => {
      await makeEligibleBorrower(); // creditLimit = 96 mUSD
      await loan.connect(borrower).requestLoan(ethers.parseUnits("96", 6));
      await token.connect(borrower).approve(await loan.getAddress(), ethers.parseUnits("30", 6));
      await loan.connect(borrower).repay(ethers.parseUnits("30", 6));

      await expect(loan.connect(borrower).requestLoan(ethers.parseUnits("30", 6))).to.not.be.reverted;
    });
  });

  describe("views", () => {
    it("availableCredit is zero for an unregistered borrower", async () => {
      expect(await loan.availableCredit(other.address)).to.equal(0);
    });

    it("availableCredit is zero for a registered borrower with too little history to be eligible", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      await submitFakeRemittance(ethers.parseUnits("50", 6), Math.floor(Date.now() / 1000), "thin-history");
      await loan.requestCreditReview(borrower.address);
      expect(await loan.availableCredit(borrower.address)).to.equal(0);
    });

    it("availableCredit reflects creditLimit minus outstandingPrincipal", async () => {
      await makeEligibleBorrower(); // creditLimit = 96 mUSD
      await loan.connect(borrower).requestLoan(ethers.parseUnits("40", 6));
      expect(await loan.availableCredit(borrower.address)).to.equal(ethers.parseUnits("56", 6));
    });

    it("getBorrower returns the full stored record", async () => {
      await makeEligibleBorrower();
      const record = await loan.getBorrower(borrower.address);
      expect(record.registered).to.equal(true);
      expect(record.declaredSender).to.equal(familySender.address);
      expect(record.eligible).to.equal(true);
      expect(record.creditLimit).to.equal(ethers.parseUnits("96", 6));
      expect(record.outstandingPrincipal).to.equal(0);
      expect(record.lastReviewedAt).to.be.greaterThan(0);
    });
  });

  describe("requestCreditReview", () => {
    it("reverts for a borrower who never registered", async () => {
      await expect(loan.requestCreditReview(other.address)).to.be.revertedWithCustomError(loan, "NotRegistered");
    });

    it("is callable by anyone, not just the borrower or owner", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      await expect(loan.connect(other).requestCreditReview(borrower.address)).to.not.be.reverted;
    });

    it("emits CreditReviewed with the decision's rationale", async () => {
      await loan.connect(borrower).registerBorrower(familySender.address);
      await expect(loan.requestCreditReview(borrower.address))
        .to.emit(loan, "CreditReviewed")
        .withArgs(borrower.address, false, 0, 0, "Not enough verified remittances yet to establish a pattern.");
    });

    it("can flip a borrower from eligible back to ineligible if their history goes stale", async () => {
      await makeEligibleBorrower();
      let record = await loan.getBorrower(borrower.address);
      expect(record.eligible).to.equal(true);

      await loan.connect(owner).setCreditEngine(await engine.getAddress()); // no-op, keeps engine explicit
      const staleParams = { ...defaultParams, maxStalenessSeconds: 0 };
      const StaleEngine = await ethers.getContractFactory("CreditDecisionEngine");
      const staleEngine = await StaleEngine.deploy(owner.address, staleParams);
      await loan.connect(owner).setCreditEngine(await staleEngine.getAddress());

      await loan.requestCreditReview(borrower.address);
      record = await loan.getBorrower(borrower.address);
      expect(record.eligible).to.equal(false);
    });
  });
});