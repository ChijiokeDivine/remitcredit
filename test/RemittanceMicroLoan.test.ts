// test/RemittanceMicroLoan.test.ts
import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RemitCredit — RemittanceMicroLoan", () => {
  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let familySender: HardhatEthersSigner;

  let prover: any;
  let registry: any;
  let engine: any;
  let token: any;
  let loan: any;

  const DAY = 24 * 60 * 60;

  const defaultParams = {
    minTransferCount: 3,
    minTotalAmount: ethers.parseUnits("300", 6), // 300 mUSD across the window
    minConsistencyBps: 5000,
    creditMultiplierBps: 3000, // credit limit = 30% of verified inflow
    maxCreditLimit: ethers.parseUnits("1000", 6),
    lookbackWindowSeconds: 180 * DAY,
    maxStalenessSeconds: 60 * DAY,
  };

  beforeEach(async () => {
    [owner, borrower, familySender] = await ethers.getSigners();

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

    // Seed the loan pool.
    await token.connect(owner).mint(owner.address, ethers.parseUnits("10000", 6));
    await token.connect(owner).approve(await loan.getAddress(), ethers.parseUnits("10000", 6));
    await loan.connect(owner).fundPool(ethers.parseUnits("10000", 6));
  });

  async function submitFakeRemittance(amount: bigint, timestamp: number, salt: string) {
    // encodedTx is a stand-in for the raw source-chain tx bytes; its exact
    // content doesn't matter to the mock prover, only its hash.
    const encodedTx = ethers.toUtf8Bytes(`tx:${salt}`);
    const sourceTxHash = ethers.keccak256(encodedTx);
    await prover.connect(owner).setVerified(encodedTx, true);

    await loan.connect(owner).submitRemittanceProof(
      borrower.address,
      1, // chainKey
      1_000_000, // blockHeight
      encodedTx,
      "0x", // merkleProof (opaque, ignored by mock)
      "0x", // continuityProof (opaque, ignored by mock)
      familySender.address,
      amount,
      timestamp,
      sourceTxHash
    );
  }

  it("registers a borrower and links their declared remittance sender", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const record = await loan.getBorrower(borrower.address);
    expect(record.registered).to.equal(true);
    expect(record.declaredSender).to.equal(familySender.address);
  });

  it("rejects a remittance proof the precompile does not verify", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const encodedTx = ethers.toUtf8Bytes("unverified-tx");
    const sourceTxHash = ethers.keccak256(encodedTx);
    // Note: never call setVerified — the mock defaults to false.

    await expect(
      loan.connect(owner).submitRemittanceProof(
        borrower.address, 1, 1, encodedTx, "0x", "0x",
        familySender.address, ethers.parseUnits("50", 6), 1, sourceTxHash
      )
    ).to.be.revertedWithCustomError(loan, "ProofNotVerified");
  });

  it("rejects a claimed sender that doesn't match the borrower's declared sender", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const encodedTx = ethers.toUtf8Bytes("tx-wrong-sender");
    const sourceTxHash = ethers.keccak256(encodedTx);
    await prover.connect(owner).setVerified(encodedTx, true);

    await expect(
      loan.connect(owner).submitRemittanceProof(
        borrower.address, 1, 1, encodedTx, "0x", "0x",
        owner.address /* not the declared sender */, ethers.parseUnits("50", 6), 1, sourceTxHash
      )
    ).to.be.revertedWithCustomError(loan, "SenderNotDeclared");
  });

  it("builds credit history from verified remittances and grants a credit line", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);

    const now = Math.floor(Date.now() / 1000);
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 60 * DAY, "1");
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 30 * DAY, "2");
    await submitFakeRemittance(ethers.parseUnits("120", 6), now - 1 * DAY, "3");

    await loan.requestCreditReview(borrower.address);
    const record = await loan.getBorrower(borrower.address);

    expect(record.eligible).to.equal(true);
    // totalAmount = 320, multiplier 30% => 96, well under the 1000 cap.
    expect(record.creditLimit).to.equal(ethers.parseUnits("96", 6));
  });

  it("lets an eligible borrower draw and repay a loan within their credit limit", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const now = Math.floor(Date.now() / 1000);
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 60 * DAY, "a");
    await submitFakeRemittance(ethers.parseUnits("100", 6), now - 30 * DAY, "b");
    await submitFakeRemittance(ethers.parseUnits("120", 6), now - 1 * DAY, "c");
    await loan.requestCreditReview(borrower.address);

    await loan.connect(borrower).requestLoan(ethers.parseUnits("50", 6));
    expect(await token.balanceOf(borrower.address)).to.equal(ethers.parseUnits("50", 6));

    await expect(
      loan.connect(borrower).requestLoan(ethers.parseUnits("50", 6))
    ).to.be.revertedWithCustomError(loan, "CreditLimitExceeded"); // 50 + 50 > 96

    await token.connect(borrower).approve(await loan.getAddress(), ethers.parseUnits("50", 6));
    await loan.connect(borrower).repay(ethers.parseUnits("50", 6));

    const record = await loan.getBorrower(borrower.address);
    expect(record.outstandingPrincipal).to.equal(0n);
  });

  it("refuses a loan for a borrower with too little or too irregular history", async () => {
    await loan.connect(borrower).registerBorrower(familySender.address);
    const now = Math.floor(Date.now() / 1000);
    await submitFakeRemittance(ethers.parseUnits("50", 6), now - 5 * DAY, "only-one");

    await loan.requestCreditReview(borrower.address);
    const record = await loan.getBorrower(borrower.address);
    expect(record.eligible).to.equal(false);

    await expect(
      loan.connect(borrower).requestLoan(ethers.parseUnits("10", 6))
    ).to.be.revertedWithCustomError(loan, "NotEligible");
  });
});
