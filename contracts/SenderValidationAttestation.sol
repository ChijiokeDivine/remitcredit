// SPDX-License-Identifier: MIT
// contracts/SenderValidationAttestation.sol
//
// Minimal, separate attestation contract for Feature 3 (sender-validation pipeline).
// Decoupled from RemittanceMicroLoan / CreditRegistry — does NOT modify or depend
// on their storage. Backend/relayer writes the final off-chain pipeline result
// on-chain for auditability; reads are public views keyed by (sender, recipient).
//
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SenderValidationAttestation
/// @notice Publishes the result of the off-chain sender-validation pipeline
///         (wallet age, funding source, sanctions, risk flags) so decisions
///         cannot be silently altered by the backend later.
contract SenderValidationAttestation is Ownable {
    // ── Types ──────────────────────────────────────────────────────────────

    /// @dev verificationStatus: 0 = pending, 1 = approved, 2 = rejected, 3 = flagged
    struct Attestation {
        address senderWallet;
        address recipient; // borrower / recipient wallet
        uint8 verificationStatus;
        uint32 walletAgeDays;
        /// @dev fundingSourceType: 0 = unknown, 1 = exchange, 2 = bridge,
        ///      3 = recipient_funded (hard reject), 4 = other_eoa, 5 = mixed
        uint8 fundingSourceType;
        bytes32[] riskFlags; // keccak256 of flag strings, or raw short codes
        uint64 timestamp;
        bool exists;
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// @notice Sole address authorized to publish attestations (backend relayer).
    address public writer;

    /// @dev sender => recipient => attestation
    mapping(address => mapping(address => Attestation)) private _attestations;

    // ── Events ─────────────────────────────────────────────────────────────

    event WriterUpdated(address indexed previousWriter, address indexed newWriter);

    event SenderAttested(
        address indexed senderWallet,
        address indexed recipient,
        uint8 verificationStatus,
        uint32 walletAgeDays,
        uint8 fundingSourceType,
        bytes32[] riskFlags,
        uint64 timestamp
    );

    // ── Errors ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error NotWriter();
    error InvalidStatus();

    // ── Constructor ────────────────────────────────────────────────────────

    constructor(address initialOwner, address initialWriter) Ownable(initialOwner) {
        if (initialWriter == address(0)) revert ZeroAddress();
        writer = initialWriter;
        emit WriterUpdated(address(0), initialWriter);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    function setWriter(address newWriter) external onlyOwner {
        if (newWriter == address(0)) revert ZeroAddress();
        address prev = writer;
        writer = newWriter;
        emit WriterUpdated(prev, newWriter);
    }

    // ── Write ──────────────────────────────────────────────────────────────

    /// @notice Publish (or overwrite) the validation result for a sender↔recipient pair.
    /// @param riskFlags keccak256-hashed flag identifiers (e.g. keccak256("SANCTIONED")).
    function attest(
        address senderWallet,
        address recipient,
        uint8 verificationStatus,
        uint32 walletAgeDays,
        uint8 fundingSourceType,
        bytes32[] calldata riskFlags
    ) external {
        if (msg.sender != writer && msg.sender != owner()) revert NotWriter();
        if (senderWallet == address(0) || recipient == address(0)) revert ZeroAddress();
        if (verificationStatus > 3) revert InvalidStatus();

        uint64 ts = uint64(block.timestamp);

        Attestation storage a = _attestations[senderWallet][recipient];
        a.senderWallet = senderWallet;
        a.recipient = recipient;
        a.verificationStatus = verificationStatus;
        a.walletAgeDays = walletAgeDays;
        a.fundingSourceType = fundingSourceType;
        a.riskFlags = riskFlags;
        a.timestamp = ts;
        a.exists = true;

        emit SenderAttested(
            senderWallet,
            recipient,
            verificationStatus,
            walletAgeDays,
            fundingSourceType,
            riskFlags,
            ts
        );
    }

    // ── Read ───────────────────────────────────────────────────────────────

    function getAttestation(
        address senderWallet,
        address recipient
    )
        external
        view
        returns (
            address sender,
            address recip,
            uint8 verificationStatus,
            uint32 walletAgeDays,
            uint8 fundingSourceType,
            bytes32[] memory riskFlags,
            uint64 timestamp,
            bool exists
        )
    {
        Attestation storage a = _attestations[senderWallet][recipient];
        return (
            a.senderWallet,
            a.recipient,
            a.verificationStatus,
            a.walletAgeDays,
            a.fundingSourceType,
            a.riskFlags,
            a.timestamp,
            a.exists
        );
    }

    function isApproved(address senderWallet, address recipient) external view returns (bool) {
        Attestation storage a = _attestations[senderWallet][recipient];
        return a.exists && a.verificationStatus == 1;
    }
}
