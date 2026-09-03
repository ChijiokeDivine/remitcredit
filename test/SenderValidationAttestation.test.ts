import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Comprehensive unit tests for SenderValidationAttestation.
 *
 * Deploy target in production: Creditcoin (CC3 testnet / mainnet) — the same
 * chain as RemittanceMicroLoan / CreditRegistry. Hardhat network is only for
 * local unit tests; the contract does not depend on Creditcoin-specific
 * precompiles, so these tests run on vanilla Hardhat EVM.
 *
 * Status codes:  0 pending | 1 approved | 2 rejected | 3 flagged
 * Funding codes: 0 unknown | 1 exchange | 2 bridge | 3 recipient_funded | 4 other_eoa | 5 mixed
 */

describe("SenderValidationAttestation", function () {
  let owner: HardhatEthersSigner;
  let writer: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let senderWallet: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;
  let secondRecipient: HardhatEthersSigner;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let attestation: any;

  const STATUS = {
    PENDING: 0,
    APPROVED: 1,
    REJECTED: 2,
    FLAGGED: 3,
  } as const;

  const FUNDING = {
    UNKNOWN: 0,
    EXCHANGE: 1,
    BRIDGE: 2,
    RECIPIENT_FUNDED: 3,
    OTHER_EOA: 4,
    MIXED: 5,
  } as const;

  const FLAG_SANCTIONED = ethers.id("SANCTIONED");
  const FLAG_RECIPIENT_FUNDED = ethers.id("RECIPIENT_FUNDED");
  const FLAG_YOUNG_WALLET = ethers.id("YOUNG_WALLET");

  beforeEach(async function () {
    [owner, writer, other, senderWallet, recipient, secondRecipient] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory(
      "SenderValidationAttestation"
    );
    attestation = await Factory.deploy(owner.address, writer.address);
    await attestation.waitForDeployment();
  });

  // ── Deployment ───────────────────────────────────────────────────────────

  describe("deployment", function () {
    it("sets owner and writer correctly", async function () {
      expect(await attestation.owner()).to.equal(owner.address);
      expect(await attestation.writer()).to.equal(writer.address);
    });

    it("emits WriterUpdated on deploy (from zero to initial writer)", async function () {
      const Factory = await ethers.getContractFactory(
        "SenderValidationAttestation"
      );
      const tx = await Factory.deploy(owner.address, writer.address);
      await expect(tx.deploymentTransaction())
        .to.emit(await tx.waitForDeployment(), "WriterUpdated")
        .withArgs(ethers.ZeroAddress, writer.address);
    });

    it("reverts when initialWriter is zero address", async function () {
      const Factory = await ethers.getContractFactory(
        "SenderValidationAttestation"
      );
      await expect(
        Factory.deploy(owner.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "ZeroAddress");
    });

    it("starts with no attestation for an arbitrary pair", async function () {
      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.exists).to.equal(false);
      expect(a.verificationStatus).to.equal(0);
      expect(a.walletAgeDays).to.equal(0);
      expect(a.fundingSourceType).to.equal(0);
      expect(a.riskFlags).to.deep.equal([]);
      expect(a.timestamp).to.equal(0);
    });

    it("isApproved returns false when no attestation exists", async function () {
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(false);
    });
  });

  // ── setWriter ────────────────────────────────────────────────────────────

  describe("setWriter", function () {
    it("owner can update the writer", async function () {
      await expect(attestation.connect(owner).setWriter(other.address))
        .to.emit(attestation, "WriterUpdated")
        .withArgs(writer.address, other.address);

      expect(await attestation.writer()).to.equal(other.address);
    });

    it("non-owner cannot setWriter", async function () {
      await expect(
        attestation.connect(other).setWriter(other.address)
      ).to.be.revertedWithCustomError(attestation, "OwnableUnauthorizedAccount");
    });

    it("reverts when newWriter is zero address", async function () {
      await expect(
        attestation.connect(owner).setWriter(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(attestation, "ZeroAddress");
    });

    it("new writer can attest after transfer; old writer cannot", async function () {
      await attestation.connect(owner).setWriter(other.address);

      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            30,
            FUNDING.EXCHANGE,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "NotWriter");

      await expect(
        attestation
          .connect(other)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            30,
            FUNDING.EXCHANGE,
            []
          )
      ).to.emit(attestation, "SenderAttested");
    });
  });

  // ── attest — access control ──────────────────────────────────────────────

  describe("attest access control", function () {
    it("writer can attest", async function () {
      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            42,
            FUNDING.EXCHANGE,
            [FLAG_YOUNG_WALLET]
          )
      ).to.emit(attestation, "SenderAttested");
    });

    it("owner can attest (bypass writer gate)", async function () {
      await expect(
        attestation
          .connect(owner)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            10,
            FUNDING.OTHER_EOA,
            []
          )
      ).to.emit(attestation, "SenderAttested");
    });

    it("random account cannot attest", async function () {
      await expect(
        attestation
          .connect(other)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "NotWriter");
    });
  });

  // ── attest — validation ──────────────────────────────────────────────────

  describe("attest input validation", function () {
    it("reverts on zero senderWallet", async function () {
      await expect(
        attestation
          .connect(writer)
          .attest(
            ethers.ZeroAddress,
            recipient.address,
            STATUS.APPROVED,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "ZeroAddress");
    });

    it("reverts on zero recipient", async function () {
      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            ethers.ZeroAddress,
            STATUS.APPROVED,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "ZeroAddress");
    });

    it("reverts on invalid verificationStatus (> 3)", async function () {
      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            4,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "InvalidStatus");

      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            255,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.be.revertedWithCustomError(attestation, "InvalidStatus");
    });

    it("accepts all valid status codes 0–3", async function () {
      for (const status of [
        STATUS.PENDING,
        STATUS.APPROVED,
        STATUS.REJECTED,
        STATUS.FLAGGED,
      ]) {
        await attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            status,
            5,
            FUNDING.UNKNOWN,
            []
          );
        const a = await attestation.getAttestation(
          senderWallet.address,
          recipient.address
        );
        expect(a.verificationStatus).to.equal(status);
        expect(a.exists).to.equal(true);
      }
    });
  });

  // ── attest — happy path & storage ────────────────────────────────────────

  describe("attest storage and events", function () {
    it("stores full attestation fields and sets exists=true", async function () {
      const flags = [FLAG_SANCTIONED, FLAG_RECIPIENT_FUNDED];
      const age = 365;

      const tx = await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.REJECTED,
          age,
          FUNDING.RECIPIENT_FUNDED,
          flags
        );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );

      expect(a.sender).to.equal(senderWallet.address);
      expect(a.recip).to.equal(recipient.address);
      expect(a.verificationStatus).to.equal(STATUS.REJECTED);
      expect(a.walletAgeDays).to.equal(age);
      expect(a.fundingSourceType).to.equal(FUNDING.RECIPIENT_FUNDED);
      expect(a.riskFlags).to.deep.equal(flags);
      expect(a.exists).to.equal(true);
      expect(a.timestamp).to.equal(block!.timestamp);
    });

    it("emits SenderAttested with correct indexed and non-indexed args", async function () {
      const flags = [FLAG_YOUNG_WALLET];

      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.FLAGGED,
            7,
            FUNDING.MIXED,
            flags
          )
      )
        .to.emit(attestation, "SenderAttested")
        .withArgs(
          senderWallet.address,
          recipient.address,
          STATUS.FLAGGED,
          7,
          FUNDING.MIXED,
          flags,
          // timestamp is dynamic — matched loosely via anyValue if available;
          // chai matchers from hardhat may require a function matcher:
          (ts: bigint) => typeof ts === "bigint" && ts > 0n
        );
    });

    it("isolates storage by (sender, recipient) pair", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          100,
          FUNDING.EXCHANGE,
          []
        );

      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          secondRecipient.address,
          STATUS.REJECTED,
          1,
          FUNDING.RECIPIENT_FUNDED,
          [FLAG_RECIPIENT_FUNDED]
        );

      const a1 = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      const a2 = await attestation.getAttestation(
        senderWallet.address,
        secondRecipient.address
      );

      expect(a1.verificationStatus).to.equal(STATUS.APPROVED);
      expect(a1.fundingSourceType).to.equal(FUNDING.EXCHANGE);
      expect(a1.riskFlags).to.deep.equal([]);

      expect(a2.verificationStatus).to.equal(STATUS.REJECTED);
      expect(a2.fundingSourceType).to.equal(FUNDING.RECIPIENT_FUNDED);
      expect(a2.riskFlags).to.deep.equal([FLAG_RECIPIENT_FUNDED]);
    });

    it("overwrites a previous attestation for the same pair", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.PENDING,
          0,
          FUNDING.UNKNOWN,
          []
        );

      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          90,
          FUNDING.BRIDGE,
          []
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.verificationStatus).to.equal(STATUS.APPROVED);
      expect(a.walletAgeDays).to.equal(90);
      expect(a.fundingSourceType).to.equal(FUNDING.BRIDGE);
      expect(a.exists).to.equal(true);
    });

    it("can clear riskFlags on overwrite by passing empty array", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.FLAGGED,
          5,
          FUNDING.OTHER_EOA,
          [FLAG_YOUNG_WALLET, FLAG_SANCTIONED]
        );

      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          5,
          FUNDING.OTHER_EOA,
          []
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.riskFlags).to.deep.equal([]);
      expect(a.verificationStatus).to.equal(STATUS.APPROVED);
    });

    it("stores an empty riskFlags array when none provided", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          50,
          FUNDING.EXCHANGE,
          []
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.riskFlags).to.deep.equal([]);
    });

    it("handles large walletAgeDays (uint32 max range)", async function () {
      const maxUseful = 365 * 100; // ~100 years
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          maxUseful,
          FUNDING.OTHER_EOA,
          []
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.walletAgeDays).to.equal(maxUseful);
    });
  });

  // ── isApproved ───────────────────────────────────────────────────────────

  describe("isApproved", function () {
    it("returns true only when exists and status == APPROVED (1)", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          30,
          FUNDING.EXCHANGE,
          []
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(true);
    });

    it("returns false for rejected", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.REJECTED,
          0,
          FUNDING.RECIPIENT_FUNDED,
          [FLAG_RECIPIENT_FUNDED]
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(false);
    });

    it("returns false for flagged", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.FLAGGED,
          3,
          FUNDING.UNKNOWN,
          [FLAG_YOUNG_WALLET]
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(false);
    });

    it("returns false for pending", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.PENDING,
          0,
          FUNDING.UNKNOWN,
          []
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(false);
    });

    it("returns false after overwrite from approved → rejected", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          10,
          FUNDING.EXCHANGE,
          []
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(true);

      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.REJECTED,
          10,
          FUNDING.RECIPIENT_FUNDED,
          [FLAG_RECIPIENT_FUNDED]
        );
      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(false);
    });
  });

  // ── Ownership (OpenZeppelin Ownable) ─────────────────────────────────────

  describe("ownership", function () {
    it("owner can transfer ownership", async function () {
      await attestation.connect(owner).transferOwnership(other.address);
      expect(await attestation.owner()).to.equal(other.address);
    });

    it("new owner can setWriter; previous owner cannot", async function () {
      await attestation.connect(owner).transferOwnership(other.address);

      await expect(
        attestation.connect(owner).setWriter(writer.address)
      ).to.be.revertedWithCustomError(attestation, "OwnableUnauthorizedAccount");

      await attestation.connect(other).setWriter(writer.address);
      expect(await attestation.writer()).to.equal(writer.address);
    });

    it("renounceOwnership leaves owner as zero; setWriter no longer works", async function () {
      await attestation.connect(owner).renounceOwnership();
      expect(await attestation.owner()).to.equal(ethers.ZeroAddress);

      await expect(
        attestation.connect(owner).setWriter(other.address)
      ).to.be.revertedWithCustomError(attestation, "OwnableUnauthorizedAccount");

      // Writer can still attest (writer role independent of ownership)
      await expect(
        attestation
          .connect(writer)
          .attest(
            senderWallet.address,
            recipient.address,
            STATUS.APPROVED,
            1,
            FUNDING.UNKNOWN,
            []
          )
      ).to.emit(attestation, "SenderAttested");
    });
  });

  // ── End-to-end pipeline-shaped scenarios ─────────────────────────────────

  describe("pipeline-shaped scenarios", function () {
    it("approved clean sender: exchange-funded, aged wallet, no flags", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          400,
          FUNDING.EXCHANGE,
          []
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.exists).to.equal(true);
      expect(a.verificationStatus).to.equal(STATUS.APPROVED);
      expect(await attestation.isApproved(senderWallet.address, recipient.address))
        .to.equal(true);
    });

    it("hard reject: sanctioned address", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.REJECTED,
          1000,
          FUNDING.OTHER_EOA,
          [FLAG_SANCTIONED]
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.verificationStatus).to.equal(STATUS.REJECTED);
      expect(a.riskFlags).to.include(FLAG_SANCTIONED);
      expect(await attestation.isApproved(senderWallet.address, recipient.address))
        .to.equal(false);
    });

    it("hard reject: recipient-funded circular funding", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.REJECTED,
          20,
          FUNDING.RECIPIENT_FUNDED,
          [FLAG_RECIPIENT_FUNDED]
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.fundingSourceType).to.equal(FUNDING.RECIPIENT_FUNDED);
      expect(a.verificationStatus).to.equal(STATUS.REJECTED);
      expect(await attestation.isApproved(senderWallet.address, recipient.address))
        .to.equal(false);
    });

    it("soft flag: young wallet only", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.FLAGGED,
          2,
          FUNDING.OTHER_EOA,
          [FLAG_YOUNG_WALLET]
        );

      const a = await attestation.getAttestation(
        senderWallet.address,
        recipient.address
      );
      expect(a.verificationStatus).to.equal(STATUS.FLAGGED);
      expect(a.walletAgeDays).to.equal(2);
      expect(await attestation.isApproved(senderWallet.address, recipient.address))
        .to.equal(false);
    });

    it("same sender approved for one recipient and rejected for another", async function () {
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          recipient.address,
          STATUS.APPROVED,
          200,
          FUNDING.EXCHANGE,
          []
        );
      await attestation
        .connect(writer)
        .attest(
          senderWallet.address,
          secondRecipient.address,
          STATUS.REJECTED,
          200,
          FUNDING.RECIPIENT_FUNDED,
          [FLAG_RECIPIENT_FUNDED]
        );

      expect(
        await attestation.isApproved(senderWallet.address, recipient.address)
      ).to.equal(true);
      expect(
        await attestation.isApproved(
          senderWallet.address,
          secondRecipient.address
        )
      ).to.equal(false);
    });
  });
});
