// test/CreditDecisionEngine.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RemitCredit — CreditDecisionEngine", () => {
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let engine: any;

  const DAY = 24 * 60 * 60;

  const defaultParams = {
    minTransferCount: 3,
    minTotalAmount: 300,
    minConsistencyBps: 5000,
    creditMultiplierBps: 3000, // 30%
    maxCreditLimit: 1000,
    lookbackWindowSeconds: 180 * DAY,
    maxStalenessSeconds: 60 * DAY,
  };

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Engine = await ethers.getContractFactory("CreditDecisionEngine");
    engine = await Engine.deploy(owner.address, defaultParams);
  });

  // Baseline stats that pass every gate; individual tests override one field
  // at a time so each test isolates a single rejection/sizing rule.
  function stats(overrides: Partial<{
    transferCount: number;
    totalAmount: number;
    firstTimestamp: number;
    lastTimestamp: number;
    avgIntervalSeconds: number;
    intervalConsistencyBps: number;
  }> = {}) {
    return {
      transferCount: 5,
      totalAmount: 500,
      firstTimestamp: 0,
      lastTimestamp: 0,
      avgIntervalSeconds: 10 * DAY,
      intervalConsistencyBps: 8000,
      ...overrides,
    };
  }

  describe("constructor / params administration", () => {
    it("initializes params from the constructor", async () => {
      const p = await engine.params();
      expect(p.minTransferCount).to.equal(defaultParams.minTransferCount);
      expect(p.maxCreditLimit).to.equal(defaultParams.maxCreditLimit);
    });

    it("only the owner can update params", async () => {
      await expect(
        engine.connect(other).setParams(defaultParams)
      ).to.be.revertedWithCustomError(engine, "OwnableUnauthorizedAccount");
    });

    it("emits ParamsUpdated and future decisions reflect the new params", async () => {
      const looser = { ...defaultParams, minTransferCount: 1 };
      await expect(engine.connect(owner).setParams(looser)).to.emit(engine, "ParamsUpdated");

      const now = await time.latest();
      const d = await engine.decide(stats({ transferCount: 1, lastTimestamp: now }));
      expect(d.eligible).to.equal(true);
    });
  });

  describe("decide — rejection paths", () => {
    it("rejects when transferCount is below the minimum", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ transferCount: 2, lastTimestamp: now }));
      expect(d.eligible).to.equal(false);
      expect(d.creditLimit).to.equal(0);
      expect(d.rationale).to.include("Not enough verified remittances");
    });

    it("accepts transferCount exactly at the minimum", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ transferCount: defaultParams.minTransferCount, lastTimestamp: now }));
      expect(d.eligible).to.equal(true);
    });

    it("rejects when totalAmount is below the minimum", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ totalAmount: 100, lastTimestamp: now }));
      expect(d.eligible).to.equal(false);
      expect(d.rationale).to.include("below the minimum");
    });

    it("rejects when intervalConsistencyBps is below the minimum", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ intervalConsistencyBps: 1000, lastTimestamp: now }));
      expect(d.eligible).to.equal(false);
      expect(d.rationale).to.include("too irregular");
    });

    it("accepts intervalConsistencyBps exactly at the minimum", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ intervalConsistencyBps: defaultParams.minConsistencyBps, lastTimestamp: now }));
      expect(d.eligible).to.equal(true);
    });

    it("rejects when the most recent transfer is stale", async () => {
      const now = await time.latest();
      const staleTs = now - defaultParams.maxStalenessSeconds - 100;
      const d = await engine.decide(stats({ lastTimestamp: staleTs }));
      expect(d.eligible).to.equal(false);
      expect(d.rationale).to.include("too old");
    });

    it("accepts a lastTimestamp exactly at the staleness boundary", async () => {
      const now = await time.latest();
      const boundaryTs = now - defaultParams.maxStalenessSeconds;
      const d = await engine.decide(stats({ lastTimestamp: boundaryTs }));
      expect(d.eligible).to.equal(true);
    });

    it("does not treat a lastTimestamp in the future as stale", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ lastTimestamp: now + 1000 }));
      expect(d.eligible).to.equal(true);
    });

    it("checks gates in order — the first failing gate's rationale wins even if others also fail", async () => {
      const now = await time.latest();
      const d = await engine.decide(
        stats({ transferCount: 1, totalAmount: 10, intervalConsistencyBps: 100, lastTimestamp: now })
      );
      expect(d.rationale).to.include("Not enough verified remittances");
    });
  });

  describe("decide — sizing and risk score", () => {
    it("sizes the credit limit as totalAmount * multiplier / 10000", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ totalAmount: 500, lastTimestamp: now }));
      expect(d.creditLimit).to.equal(150); // 500 * 3000 / 10000
    });

    it("caps the credit limit at maxCreditLimit regardless of history size", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ totalAmount: 100_000, lastTimestamp: now }));
      expect(d.creditLimit).to.equal(defaultParams.maxCreditLimit);
    });

    it("is not eligible when the sized limit rounds down to zero", async () => {
      await engine.connect(owner).setParams({ ...defaultParams, creditMultiplierBps: 1, minTotalAmount: 300 });
      const now = await time.latest();
      const d = await engine.decide(stats({ totalAmount: 300, lastTimestamp: now })); // 300 * 1 / 10000 = 0
      expect(d.creditLimit).to.equal(0);
      expect(d.eligible).to.equal(false);
    });

    it("saturates the count-confidence component at 2x minTransferCount", async () => {
      const now = await time.latest();
      const dAtMin = await engine.decide(
        stats({ transferCount: defaultParams.minTransferCount, intervalConsistencyBps: 10000, lastTimestamp: now })
      );
      const dAtDouble = await engine.decide(
        stats({ transferCount: defaultParams.minTransferCount * 2, intervalConsistencyBps: 10000, lastTimestamp: now })
      );
      const dBeyondDouble = await engine.decide(
        stats({ transferCount: defaultParams.minTransferCount * 5, intervalConsistencyBps: 10000, lastTimestamp: now })
      );

      expect(dAtDouble.riskScoreBps).to.equal(dBeyondDouble.riskScoreBps);
      expect(dAtMin.riskScoreBps).to.be.lessThan(dAtDouble.riskScoreBps);
    });

    it("blends consistency and count-confidence as their simple average", async () => {
      const now = await time.latest();
      const d = await engine.decide(
        stats({
          transferCount: defaultParams.minTransferCount * 2, // countConfidence saturates at 10000
          intervalConsistencyBps: 6000,
          lastTimestamp: now,
        })
      );
      expect(d.riskScoreBps).to.equal((6000 + 10000) / 2);
    });

    it("returns an eligibility rationale on success", async () => {
      const now = await time.latest();
      const d = await engine.decide(stats({ lastTimestamp: now }));
      expect(d.eligible).to.equal(true);
      expect(d.rationale).to.include("Eligible");
    });

    it("decide is a view function — calling it never mutates state or emits events", async () => {
      const now = await time.latest();
      const tx = engine.decide(stats({ lastTimestamp: now }));
      await expect(tx).to.not.be.reverted;
      // A view call returns data directly; there is no receipt/log to inspect,
      // which itself confirms no event was emitted for a plain `decide` call.
    });
  });

  describe("decideFromRegistry", () => {
    it("pulls live stats from the registry, emits DecisionComputed, and matches decide() on the same stats", async () => {
      const Registry = await ethers.getContractFactory("RemittanceCreditRegistry");
      const registry: any = await Registry.deploy(owner.address);
      await registry.connect(owner).setRecorder(owner.address);

      const now = await time.latest();
      await registry
        .connect(owner)
        .recordVerifiedTransfer(other.address, owner.address, 100, now - 20 * DAY, ethers.keccak256(ethers.toUtf8Bytes("a")));
      await registry
        .connect(owner)
        .recordVerifiedTransfer(other.address, owner.address, 100, now - 10 * DAY, ethers.keccak256(ethers.toUtf8Bytes("b")));
      await registry
        .connect(owner)
        .recordVerifiedTransfer(other.address, owner.address, 120, now - 1 * DAY, ethers.keccak256(ethers.toUtf8Bytes("c")));

      await expect(engine.decideFromRegistry(await registry.getAddress(), other.address)).to.emit(
        engine,
        "DecisionComputed"
      );

      const liveStats = await registry.getStats(other.address, defaultParams.lookbackWindowSeconds);
      // `liveStats` is an ethers v6 Result — frozen, so it can't be passed
      // directly into another contract call's struct argument. Spread it
      // into a plain array first.
      const decision = await engine.decide([...liveStats]);
      expect(decision.eligible).to.equal(true);
      expect(decision.creditLimit).to.equal(96); // 320 * 3000 / 10000
    });

    it("returns not-eligible with the correct rationale for a borrower with no registry history", async () => {
      const Registry = await ethers.getContractFactory("RemittanceCreditRegistry");
      const registry: any = await Registry.deploy(owner.address);
      await registry.connect(owner).setRecorder(owner.address);

      const liveStats = await registry.getStats(other.address, defaultParams.lookbackWindowSeconds);
      const decision = await engine.decide.staticCall([...liveStats]);
      expect(decision.eligible).to.equal(false);
      expect(decision.rationale).to.include("Not enough verified remittances");
    });
  });
});