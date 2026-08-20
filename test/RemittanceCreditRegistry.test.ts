// test/RemittanceCreditRegistry.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RemitCredit — RemittanceCreditRegistry", () => {
  let owner: HardhatEthersSigner;
  let recorder: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let sender: HardhatEthersSigner;
  let registry: any;

  const DAY = 24 * 60 * 60;

  beforeEach(async () => {
    [owner, recorder, other, borrower, sender] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("RemittanceCreditRegistry");
    registry = await Registry.deploy(owner.address);
    await registry.connect(owner).setRecorder(recorder.address);
  });

  function hash(salt: string) {
    return ethers.keccak256(ethers.toUtf8Bytes(salt));
  }

  describe("access control", () => {
    it("only the owner can set the recorder", async () => {
      await expect(
        registry.connect(other).setRecorder(other.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("emits RecorderUpdated with the previous and new recorder", async () => {
      await expect(registry.connect(owner).setRecorder(other.address))
        .to.emit(registry, "RecorderUpdated")
        .withArgs(recorder.address, other.address);
    });

    it("rejects recordVerifiedTransfer from any address that isn't the recorder", async () => {
      await expect(
        registry.connect(other).recordVerifiedTransfer(
          borrower.address,
          sender.address,
          100,
          1,
          hash("not-recorder")
        )
      ).to.be.revertedWithCustomError(registry, "NotRecorder");
    });

    it("rejects recordVerifiedTransfer from the previous recorder after it's been rotated out", async () => {
      await registry.connect(owner).setRecorder(other.address);
      await expect(
        registry.connect(recorder).recordVerifiedTransfer(
          borrower.address,
          sender.address,
          100,
          1,
          hash("stale-recorder")
        )
      ).to.be.revertedWithCustomError(registry, "NotRecorder");
    });
  });

  describe("recordVerifiedTransfer", () => {
    it("records a transfer, marks the hash used, and emits VerifiedTransferRecorded", async () => {
      const h = hash("t1");
      await expect(
        registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, h)
      )
        .to.emit(registry, "VerifiedTransferRecorded")
        .withArgs(borrower.address, sender.address, 100, 1000, h);

      expect(await registry.isTransferRecorded(h)).to.equal(true);
      const transfers = await registry.getTransfers(borrower.address);
      expect(transfers.length).to.equal(1);
      expect(transfers[0].amount).to.equal(100);
      expect(transfers[0].sender).to.equal(sender.address);
      expect(transfers[0].sourceTimestamp).to.equal(1000);
      expect(transfers[0].sourceTxHash).to.equal(h);
    });

    it("rejects a duplicate source tx hash even for a different borrower", async () => {
      const h = hash("dup");
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, h);
      await expect(
        registry.connect(recorder).recordVerifiedTransfer(other.address, sender.address, 50, 2000, h)
      )
        .to.be.revertedWithCustomError(registry, "DuplicateTransfer")
        .withArgs(h);
    });

    it("rejects an out-of-order timestamp for the same borrower", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 2000, hash("a"));
      await expect(
        registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, hash("b"))
      )
        .to.be.revertedWithCustomError(registry, "OutOfOrderTimestamp")
        .withArgs(1000, 2000);
    });

    it("accepts equal consecutive timestamps (non-decreasing, not strictly increasing)", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, hash("eq1"));
      await expect(
        registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, hash("eq2"))
      ).to.not.be.reverted;
    });

    it("keeps independent, non-interfering histories per borrower", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1000, hash("b1"));
      await registry.connect(recorder).recordVerifiedTransfer(other.address, sender.address, 200, 1, hash("o1"));
      expect((await registry.getTransfers(borrower.address)).length).to.equal(1);
      expect((await registry.getTransfers(other.address)).length).to.equal(1);
    });
  });

  describe("getTransfersPaginated", () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await registry
          .connect(recorder)
          .recordVerifiedTransfer(borrower.address, sender.address, 100 + i, 1000 + i, hash(`page-${i}`));
      }
    });

    it("returns a slice of the requested size", async () => {
      const page = await registry.getTransfersPaginated(borrower.address, 1, 2);
      expect(page.length).to.equal(2);
      expect(page[0].amount).to.equal(101);
      expect(page[1].amount).to.equal(102);
    });

    it("truncates the page when limit exceeds remaining items", async () => {
      const page = await registry.getTransfersPaginated(borrower.address, 3, 10);
      expect(page.length).to.equal(2);
      expect(page[0].amount).to.equal(103);
      expect(page[1].amount).to.equal(104);
    });

    it("returns an empty array when offset is out of range", async () => {
      const page = await registry.getTransfersPaginated(borrower.address, 100, 10);
      expect(page.length).to.equal(0);
    });

    it("returns an empty array when limit is zero", async () => {
      const page = await registry.getTransfersPaginated(borrower.address, 0, 0);
      expect(page.length).to.equal(0);
    });

    it("returns an empty array for a borrower with no history", async () => {
      const page = await registry.getTransfersPaginated(other.address, 0, 5);
      expect(page.length).to.equal(0);
    });
  });

  describe("getStats", () => {
    it("returns zeroed stats for a borrower with no history", async () => {
      const stats = await registry.getStats(borrower.address, 180 * DAY);
      expect(stats.transferCount).to.equal(0);
      expect(stats.totalAmount).to.equal(0);
      expect(stats.firstTimestamp).to.equal(0);
      expect(stats.lastTimestamp).to.equal(0);
    });

    it("returns stats for a single transfer without computing intervals", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 500, 1000, hash("single"));
      const stats = await registry.getStats(borrower.address, 180 * DAY);
      expect(stats.transferCount).to.equal(1);
      expect(stats.totalAmount).to.equal(500);
      expect(stats.firstTimestamp).to.equal(1000);
      expect(stats.lastTimestamp).to.equal(1000);
      expect(stats.avgIntervalSeconds).to.equal(0);
      expect(stats.intervalConsistencyBps).to.equal(0);
    });

    it("excludes transfers older than the lookback window", async () => {
      const now = 100 * DAY;
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 0, hash("old"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 200, now, hash("new"));

      const stats = await registry.getStats(borrower.address, 10 * DAY);
      expect(stats.transferCount).to.equal(1);
      expect(stats.totalAmount).to.equal(200);
    });

    it("includes all transfers when the lookback window exceeds the last timestamp", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 10, hash("w1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 20, hash("w2"));
      const stats = await registry.getStats(borrower.address, 1_000_000_000);
      expect(stats.transferCount).to.equal(2);
      expect(stats.totalAmount).to.equal(200);
    });

    it("computes perfectly regular intervals as full consistency (10000 bps)", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 0, hash("r1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 10 * DAY, hash("r2"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 20 * DAY, hash("r3"));

      const stats = await registry.getStats(borrower.address, 180 * DAY);
      expect(stats.avgIntervalSeconds).to.equal(10 * DAY);
      expect(stats.intervalConsistencyBps).to.equal(10000);
    });

    it("lowers consistency for irregular intervals", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 0, hash("i1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 1 * DAY, hash("i2"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 30 * DAY, hash("i3"));

      const stats = await registry.getStats(borrower.address, 180 * DAY);
      expect(stats.intervalConsistencyBps).to.be.lessThan(10000);
    });

    it("treats same-second transfers as perfectly regular (mean interval zero, no divide-by-zero)", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 500, hash("s1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 500, hash("s2"));
      const stats = await registry.getStats(borrower.address, 180 * DAY);
      expect(stats.avgIntervalSeconds).to.equal(0);
      expect(stats.intervalConsistencyBps).to.equal(10000);
    });

    it("bounds firstTimestamp/lastTimestamp to the in-window slice, not the full history", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 0, hash("f1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 50 * DAY, hash("f2"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 100 * DAY, hash("f3"));

      // windowStart = lastTs(100d) - lookback(60d) = 40d, so only f2 (50d) and f3 (100d) qualify.
      const stats = await registry.getStats(borrower.address, 60 * DAY);
      expect(stats.transferCount).to.equal(2);
      expect(stats.totalAmount).to.equal(200);
      expect(stats.firstTimestamp).to.equal(50 * DAY);
      expect(stats.lastTimestamp).to.equal(100 * DAY);
    });

    it("is a pure view — repeated calls with the same inputs return identical results", async () => {
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 0, hash("p1"));
      await registry.connect(recorder).recordVerifiedTransfer(borrower.address, sender.address, 100, 5 * DAY, hash("p2"));
      const a = await registry.getStats(borrower.address, 180 * DAY);
      const b = await registry.getStats(borrower.address, 180 * DAY);
      expect(a.totalAmount).to.equal(b.totalAmount);
      expect(a.intervalConsistencyBps).to.equal(b.intervalConsistencyBps);
    });
  });
});